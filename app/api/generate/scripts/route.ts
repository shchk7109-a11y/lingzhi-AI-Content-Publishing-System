import { NextResponse } from 'next/server';
import { createAIClient, getModelName, getProvider, isReasoningModel, isJsonFormatUnsupported, cleanJsonResponse } from '@/lib/ai-client';
import { getPrompts } from '@/lib/prompts';
import { getKnowledgeBase } from '@/lib/knowledge-server';

/**
 * 构建口感优势上下文字符串（与 topics/route.ts 保持一致）
 */
function buildTasteAdvantageContext(kb: ReturnType<typeof getKnowledgeBase>): string {
  const lines: string[] = [];

  const ta = kb.brand.taste_advantage;
  if (ta) {
    lines.push('【品牌口感差异化矩阵】');
    if (ta.core_positioning) lines.push(`核心口感定位：${ta.core_positioning}`);
    if (ta.vs_milk_tea?.summary) {
      lines.push(`对比奶茶：${ta.vs_milk_tea.summary}`);
      if (ta.vs_milk_tea.details?.length) lines.push(`  详细优势：${ta.vs_milk_tea.details.join(' | ')}`);
    }
    if (ta.vs_traditional_herbal?.summary) {
      lines.push(`对比传统草本：${ta.vs_traditional_herbal.summary}`);
      if (ta.vs_traditional_herbal.details?.length) lines.push(`  详细优势：${ta.vs_traditional_herbal.details.join(' | ')}`);
    }
    if (ta.technology_advantage) lines.push(`技术/工艺优势：${ta.technology_advantage}`);
    if (ta.brand_promise) lines.push(`品牌口感承诺：${ta.brand_promise}`);
  }

  const productTasteLines: string[] = [];
  for (const product of kb.products) {
    if (product.taste_advantage) {
      const pta = product.taste_advantage;
      const parts: string[] = [];
      if (pta.category_taste_advantage) parts.push(`口感定位：${pta.category_taste_advantage}`);
      if (pta.core_selling_points?.length) parts.push(`核心卖点：${pta.core_selling_points.join(' | ')}`);
      if (pta.key_phrases?.length) parts.push(`关键话术：${pta.key_phrases.join(' | ')}`);
      if (parts.length > 0) {
        productTasteLines.push(`${product.name}（${product.category}）— ${parts.join('；')}`);
      }
    }
  }
  if (productTasteLines.length > 0) {
    lines.push('\n【产品线口感特色】');
    lines.push(...productTasteLines);
  }

  lines.push('\n【通用口感话术库】');
  lines.push('草本茶饮：「无苦涩，有回甘，像喝甜品一样」「入口柔和，没有中药感，但有淡淡回甘」');
  lines.push('草本咖啡：「不改喝咖啡的习惯，增加了养生功效」「咖啡师都喝不出加了草本」「入口是熟悉的美式，回味是温润的甘甜」');
  lines.push('通用：「良药与甜品的和解」「比奶茶健康，味道差不多」「每杯口感一致，标准化更安全」');

  return lines.length > 0 ? lines.join('\n') : '（暂无口感优势数据，请在知识库管理页面填写）';
}

/**
 * 5种内容角度定义（对应 PDF 方案的5类内容分配）
 */
const CONTENT_ANGLES = [
  {
    id: 'formula',
    label: '配方科普向',
    desc: '侧重点：成分功效 + 科学原理。角度：揭秘"为什么这个配方有效"。关键词：灵芝多糖、协同作用、分子机制。必含元素：2-3个成分的具体功效、简单的科学解释、"原来如此"的恍然大悟感。结构：开头提出常见误区→中间揭秘配方原理（分点：成分A→成分B→协同效果）→结尾互动提问。',
  },
  {
    id: 'taste',
    label: '口感体验向',
    desc: '侧重点：口感描述 + 饮用体验。角度：第一人称真实体验分享。关键词：回甘、顺滑、不苦涩、惊喜。必含元素：详细的口感描述（前中后调）、与传统方式的对比、喝完后的身体感受。结构：开头场景切入（第一次喝的场景）→中间口感层次描述→结尾推荐给同类人群。',
  },
  {
    id: 'solution',
    label: '问题解决向',
    desc: '侧重点：痛点解决 + 效果展示。角度：从困扰到解决的转变。关键词：终于、解决了、不再、告别。必含元素：具体痛点描述（有画面感）、使用前后的对比、具体效果（时间/感受）。结构：开头痛点共鸣（"谁懂啊..."）→中间尝试过程+效果出现→结尾鼓励尝试+提问。',
  },
  {
    id: 'story',
    label: '场景故事向',
    desc: '侧重点：情感共鸣 + 生活方式。角度：一个完整的小故事。关键词：习惯、改变、发现、成为。必含元素：具体场景（时间地点）、情感变化（从X到Y）、产品作为转折点。结构：开头背景设定→中间遇到问题→发现产品→生活改变→结尾感悟分享+邀请共鸣。',
  },
  {
    id: 'comparison',
    label: '对比评测向',
    desc: '侧重点：客观对比 + 信任建立。角度：专业评测或真实对比。关键词：对比、测评、区别、选择。必含元素：与2-3个替代方案的对比、具体维度的比较、明确的推荐理由。结构：开头说明对比目的→中间多维度对比→结尾总结推荐。',
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, platform = 'video', angle_id } = body;
    const pillar_name = body.pillar_name || '';
    const content_type = body.content_type || '';
    const strategy_explanation = body.strategy_explanation || '';

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { error: "Invalid input. Must provide a 'topic' string." },
        { status: 400 }
      );
    }

    const kb = getKnowledgeBase();
    const prompts = getPrompts();

    // 1. Smart Product Filtering
    const topicLower = topic.toLowerCase();
    const isCoffeeTopic = topicLower.includes('咖啡') || topicLower.includes('美式') || topicLower.includes('拿铁') || topicLower.includes('coffee');
    const isTeaTopic = topicLower.includes('茶') || topicLower.includes('饮') || topicLower.includes('tea');
    
    const relevantProducts = kb.products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      const name = p.name.toLowerCase();
      if (isCoffeeTopic) return cat.includes('咖啡') || name.includes('咖啡') || name.includes('美式');
      if (isTeaTopic) return cat.includes('茶') || name.includes('茶') || name.includes('饮');
      return true;
    });

    // 2. Prepare Context
    const allIngredients = relevantProducts.map(p => `${p.name}: ${p.ingredients || '未填写'}`).join('\n');
    
    const fullPersonaContext = relevantProducts.map(p => 
      p.personas.map(per => `
      【角色: ${per.role}】
      - 痛点 (Pain Points): ${per.pain_points.join('; ')}
      - 潜在反对意见 (Objections): ${per.objections.join('; ')}
      - 竞品未解决痛点 (Unsolved): ${per.unsolved_reasons.join('; ')}
      - 营销切入点 (Angles): ${per.marketing_angles.join('; ')}
      `).join('\n')
    ).join('\n');

    // 3. 构建口感优势上下文
    const tasteAdvantageContext = buildTasteAdvantageContext(kb);

    // 构建 marketing_angles 上下文
    const fullMarketingAnglesContext = relevantProducts.map(p =>
      p.personas.map(per =>
        `${per.role}：${per.marketing_angles.join('；')}`
      ).join('\n')
    ).join('\n');

    // 口感关键词简写
    const tasteKeywords = (() => {
      const phrases: string[] = [];
      const ta = kb.brand.taste_advantage;
      if (ta?.vs_milk_tea?.summary) phrases.push(ta.vs_milk_tea.summary);
      if (ta?.vs_traditional_herbal?.summary) phrases.push(ta.vs_traditional_herbal.summary);
      if (ta?.core_positioning) phrases.push(ta.core_positioning);
      return phrases.join('；') || '无苦涩，有回甘';
    })();

    // 创始人信息：仅短视频平台注入，小红书和朋友圈不注入
    const founderContext = platform === 'video'
      ? `创始人：${kb.founder.name}\n核心背书：25年液态灵芝产业化专家，曾创立"中祥灵芝"品牌并实现1亿元资本退出。\n创业故事：${kb.founder.story}\n技术背景：${kb.founder.background}`
      : '（当前平台不使用创始人信息）';

    // 4. 确定内容角度
    // 如果传入了 angle_id，使用指定角度；否则生成全部5篇
    const targetAngles = angle_id
      ? CONTENT_ANGLES.filter(a => a.id === angle_id)
      : CONTENT_ANGLES;

    if (targetAngles.length === 0) {
      return NextResponse.json(
        { error: `Unknown angle_id: ${angle_id}` },
        { status: 400 }
      );
    }

    // 5. Select System Prompt Template
    let systemPromptTemplate = "";
    if (platform === 'xiaohongshu') {
      systemPromptTemplate = prompts.scripts_system_xhs;
    } else if (platform === 'wechat') {
      systemPromptTemplate = prompts.scripts_system_wechat;
    } else {
      systemPromptTemplate = prompts.scripts_system_video;
    }

    const openai = createAIClient(request);
    const modelName = getModelName(request);
    const provider = getProvider(request);
    const reasoning = isReasoningModel(modelName);
    const jsonUnsupported = isJsonFormatUnsupported(modelName, provider);
    const needsPromptJson = reasoning || jsonUnsupported;

    // 6. 如果只生成单篇（angle_id 指定），直接返回单篇结果
    if (angle_id) {
      const angle = targetAngles[0];
      const systemPrompt = systemPromptTemplate
        .replace(/\{\{brand_name\}\}/g, kb.brand.name)
        .replace(/\{\{ingredients\}\}/g, allIngredients)
        .replace(/\{\{pain_points\}\}/g, fullPersonaContext)
        .replace(/\{\{marketing_angles\}\}/g, fullMarketingAnglesContext)
        .replace(/\{\{platform\}\}/g, platform)
        .replace(/\{\{taste_advantage\}\}/g, tasteAdvantageContext)
        .replace(/\{\{pillar_name\}\}/g, pillar_name)
        .replace(/\{\{content_type\}\}/g, content_type)
        .replace(/\{\{strategy_explanation\}\}/g, strategy_explanation)
        .replace(/\{\{topic\}\}/g, topic)
        .replace(/\{\{founder_context\}\}/g, founderContext)
        .replace(/\{\{taste_keywords\}\}/g, tasteKeywords)
        + `\n\n**当前内容角度：${angle.label}**\n${angle.desc}`;

      const finalSystemPrompt = needsPromptJson
        ? systemPrompt + '\n\n**IMPORTANT: You MUST respond with valid JSON only. No markdown, no extra text. Output the raw JSON object directly.**'
        : systemPrompt;

      const userPrompt = prompts.scripts_user
        .replace(/\{\{topic\}\}/g, topic)
        .replace(/\{\{pillar_name\}\}/g, pillar_name)
        .replace(/\{\{content_type\}\}/g, content_type)
        .replace(/\{\{strategy_explanation\}\}/g, strategy_explanation);

      const completionParams: any = {
        model: modelName,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      if (!needsPromptJson) completionParams.response_format = { type: 'json_object' };

      const completion = await openai.chat.completions.create(completionParams);
      const content = completion.choices[0].message.content;
      if (!content) throw new Error("No content received from AI");

      const result = JSON.parse(cleanJsonResponse(content));
      return NextResponse.json({ ...result, angle_id: angle.id, angle_label: angle.label });
    }

    // 7. 生成全部5篇（并发）
    const results = await Promise.allSettled(
      targetAngles.map(async (angle) => {
        const systemPrompt = systemPromptTemplate
          .replace(/\{\{brand_name\}\}/g, kb.brand.name)
          .replace(/\{\{ingredients\}\}/g, allIngredients)
          .replace(/\{\{pain_points\}\}/g, fullPersonaContext)
          .replace(/\{\{marketing_angles\}\}/g, fullMarketingAnglesContext)
          .replace(/\{\{platform\}\}/g, platform)
          .replace(/\{\{taste_advantage\}\}/g, tasteAdvantageContext)
          .replace(/\{\{pillar_name\}\}/g, pillar_name)
          .replace(/\{\{content_type\}\}/g, content_type)
          .replace(/\{\{strategy_explanation\}\}/g, strategy_explanation)
          .replace(/\{\{topic\}\}/g, topic)
          .replace(/\{\{founder_context\}\}/g, founderContext)
          .replace(/\{\{taste_keywords\}\}/g, tasteKeywords)
          + `\n\n**当前内容角度：${angle.label}**\n${angle.desc}`;

        const finalSystemPrompt = needsPromptJson
          ? systemPrompt + '\n\n**IMPORTANT: You MUST respond with valid JSON only. No markdown, no extra text. Output the raw JSON object directly.**'
          : systemPrompt;

        const userPrompt = prompts.scripts_user
          .replace(/\{\{topic\}\}/g, topic)
          .replace(/\{\{pillar_name\}\}/g, pillar_name)
          .replace(/\{\{content_type\}\}/g, content_type)
          .replace(/\{\{strategy_explanation\}\}/g, strategy_explanation);

        const completionParams: any = {
          model: modelName,
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        };
        if (!needsPromptJson) completionParams.response_format = { type: 'json_object' };

        const completion = await openai.chat.completions.create(completionParams);
        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content received from AI");

        const parsed = JSON.parse(cleanJsonResponse(content));
        return { ...parsed, angle_id: angle.id, angle_label: angle.label };
      })
    );

    // 8. 整理结果
    const angles: Record<string, any> = {};
    results.forEach((result, idx) => {
      const angle = targetAngles[idx];
      if (result.status === 'fulfilled') {
        angles[angle.id] = result.value;
      } else {
        angles[angle.id] = {
          angle_id: angle.id,
          angle_label: angle.label,
          error: result.reason?.message || '生成失败',
        };
      }
    });

    return NextResponse.json({ angles, multi: true });

  } catch (error: any) {
    console.error("Error generating script/copy:", error);
    if (error.message === 'NO_API_KEY_CONFIGURED') {
      return NextResponse.json(
        { error: "请先配置 AI 模型", details: "请点击右上角设置图标，填写 API Key 后再试。" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate content", details: error.message },
      { status: 500 }
    );
  }
}

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

interface QualityCheckResult {
  passed: boolean;
  issues: string[];
}

function checkContentQuality(result: any, platform: string): QualityCheckResult {
  const issues: string[] = [];

  // 通用：检查冲泡场景（所有平台）
  const allText = JSON.stringify(result);
  const wrongScenePatterns = ['冲泡', '热水一冲', '泡了杯', '自己泡', '冲一杯', '泡上这杯', '办公室冲'];
  for (const pattern of wrongScenePatterns) {
    if (allText.includes(pattern)) {
      issues.push(`包含错误的冲泡场景「${pattern}」（灵芝水铺是门店现制，不是冲泡包）`);
    }
  }

  if (platform === 'xiaohongshu') {
    const content = result.content || '';
    const chineseChars = content.match(/[\u4e00-\u9fff]/g) || [];
    const contentLen = chineseChars.length;

    if (contentLen < 200) issues.push(`正文过短（${contentLen}字，要求≥200字）`);
    if (contentLen > 500) issues.push(`正文过长（${contentLen}字，要求≤500字）`);
    if (!content.includes('药食同源') && !content.includes('不能代替药物')) {
      issues.push('缺少合规声明');
    }

    const tags = result.tags || [];
    if (tags.length < 4) issues.push(`标签不足（${tags.length}个，要求≥5个）`);
    if (!tags.some((t: string) => t.includes('灵芝水铺'))) {
      issues.push('标签缺少 #灵芝水铺');
    }

    const aiPatterns = ['宝子们', '家人们', '姐妹们看过来', '集美们', '赶紧冲', '闭眼入', '不买后悔'];
    for (const p of aiPatterns) {
      if (content.includes(p)) issues.push(`包含AI味词汇「${p}」`);
    }

    const brandIndex = content.indexOf('灵芝水铺');
    if (brandIndex !== -1 && brandIndex < content.length * 0.3) {
      issues.push('品牌名出现在正文前1/3');
    }

  } else if (platform === 'wechat') {
    const content = result.content || '';
    const chineseChars = content.match(/[\u4e00-\u9fff]/g) || [];
    const contentLen = chineseChars.length;

    if (contentLen > 100) issues.push(`正文过长（${contentLen}字，朋友圈要求≤80字）`);
    if (!content.includes('药食同源') && !content.includes('不能代替药物')) {
      issues.push('缺少合规声明');
    }
    if (!content.includes('配图')) {
      issues.push('缺少配图建议');
    }

  } else if (platform === 'video') {
    if (!result.hook) issues.push('缺少黄金3秒钩子');
    if (!result.scenes || result.scenes.length < 2) {
      issues.push('分镜不足（要求≥3个场景）');
    }
    if (result.scenes) {
      for (let i = 0; i < result.scenes.length; i++) {
        const scene = result.scenes[i];
        if (!scene.visual || scene.visual.length < 10) {
          issues.push(`场景${i+1}画面描述过于简略`);
        }
      }
    }
    if (allText.includes('创始人孙勇') || allText.includes('我研究了25年')) {
      issues.push('包含创始人出镜内容');
    }
  }

  return { passed: issues.length === 0, issues };
}

function getMatchingExample(
  kb: ReturnType<typeof getKnowledgeBase>,
  platform: string,
  angleId: string
): string {
  const examples = (kb as any).examples || [];
  if (examples.length === 0) return '';

  // 精确匹配：平台 + 角度
  const exact = examples.find((e: any) =>
    e.platform === platform && e.content_type === angleId
  );
  if (exact) {
    return `【参考范文 · ${exact.note || exact.content_type}】\n标题：${exact.title}\n\n${exact.content}`;
  }

  // 模糊匹配：同平台任意范文
  const samePlatform = examples.find((e: any) => e.platform === platform);
  if (samePlatform) {
    return `【参考范文】\n标题：${samePlatform.title}\n\n${samePlatform.content}`;
  }

  return '';
}

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

    // 品牌技术背景：仅短视频平台注入，小红书和朋友圈不注入
    // 注意：不注入创始人个人信息，只提供品牌技术背书素材（用于旁白/字幕，创始人不出镜）
    const founderContext = platform === 'video'
      ? `品牌技术背景：25年液态灵芝发酵技术积累，去除苦涩味保留功效成分。\n技术亮点：液态发酵使分子量更小更易吸收，发酵自然带来回甘无需添加糖。\n信任背书：已有成功的产业化经验（前品牌年销百万瓶）。\n注意：以上信息仅用于旁白/字幕背书，创始人不出镜。`
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
      let systemPrompt = systemPromptTemplate
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

      const dynamicExample = getMatchingExample(kb, platform, angle_id || '');
      if (dynamicExample) {
        systemPrompt = systemPrompt + '\n\n### 额外参考范文（来自范文库，学习风格不要抄内容）\n' + dynamicExample;
      }

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

      const qualityCheck = checkContentQuality(result, platform);
      if (!qualityCheck.passed) {
        console.log('[Quality Check] Issues:', qualityCheck.issues);

        try {
          const retryUserPrompt = userPrompt +
            '\n\n⚠️ 上一次生成存在以下问题，请务必修正：\n' +
            qualityCheck.issues.map((issue, i) => `${i+1}. ${issue}`).join('\n') +
            '\n请严格修正后重新输出。';

          const retryParams = { ...completionParams };
          retryParams.messages = [
            retryParams.messages[0],
            { role: 'user', content: retryUserPrompt },
          ];

          const retryCompletion = await openai.chat.completions.create(retryParams);
          const retryContent = retryCompletion.choices[0].message.content;
          if (retryContent) {
            const retryResult = JSON.parse(cleanJsonResponse(retryContent));
            const retryCheck = checkContentQuality(retryResult, platform);

            if (retryCheck.passed || retryCheck.issues.length < qualityCheck.issues.length) {
              return NextResponse.json({
                ...retryResult,
                angle_id: angle.id,
                angle_label: angle.label,
                _quality: { passed: retryCheck.passed, issues: retryCheck.issues, retried: true }
              });
            }
          }
        } catch (retryErr) {
          console.error('[Quality Check] Retry failed:', retryErr);
        }
      }

      return NextResponse.json({
        ...result,
        angle_id: angle.id,
        angle_label: angle.label,
        _quality: { passed: qualityCheck.passed, issues: qualityCheck.issues, retried: false }
      });
    }

    // 7. 生成全部5篇（并发）
    const results = await Promise.allSettled(
      targetAngles.map(async (angle) => {
        let systemPrompt = systemPromptTemplate
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

        const dynamicExample = getMatchingExample(kb, platform, angle.id);
        if (dynamicExample) {
          systemPrompt = systemPrompt + '\n\n### 额外参考范文（来自范文库，学习风格不要抄内容）\n' + dynamicExample;
        }

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
        const qc = checkContentQuality(parsed, platform);
        return { ...parsed, angle_id: angle.id, angle_label: angle.label, _quality: { passed: qc.passed, issues: qc.issues } };
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

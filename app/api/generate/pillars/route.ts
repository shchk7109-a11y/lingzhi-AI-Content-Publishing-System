import { NextResponse } from 'next/server';
import { createAIClient, getModelName, getProvider, isReasoningModel, isJsonFormatUnsupported, cleanJsonResponse } from '@/lib/ai-client';
import { getKnowledgeBase } from '@/lib/knowledge-server';
import { getPrompts } from '@/lib/prompts';

const CATEGORY_CONTEXT: Record<string, string> = {
  brand: "品牌整体定位与核心价值观",
  herbal_tea: "草本茶饮系列产品（灵芝茶饮、花草茶等）",
  herbal_coffee: "草本咖啡系列产品（灵芝咖啡、黑咖啡等）",
  explore: "探店打卡体验内容（门店环境、服务体验、打卡场景）",
  health: "养生科普内容（中草药知识、健康生活方式、功效科普）",
  lifestyle: "都市健康生活方式（职场养生、精致生活、国潮养生）",
};

// 品牌模式下的通用客户画像（跨产品）
const BRAND_GENERAL_PERSONAS = `都市健康消费人群（三类核心画像）：
1. 朋克养生白领（25-35岁）：工作节奏快，关注健康但无暇炖煮，追求"好喝+有效"的日常养生，愿意为有品质感的健康饮品付费。
2. 精致妈妈/女性精英（30-40岁）：注重自身气色与抗老，对成分敏感，追求"内调外养"，希望养生融入日常而非额外负担。
3. 银发新青年/健康前瞻者（40-55岁）：主动管理健康，认可传统草本价值，对创始人背景和技术背书有较高信任需求。`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, productId, category = 'brand' } = body;

    if (!mode || (mode !== 'brand' && mode !== 'product')) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'brand' or 'product'." },
        { status: 400 }
      );
    }

    const kb = getKnowledgeBase();
    const prompts = getPrompts();

    // ==========================================
    // 1. 构建【品牌与创始人背书】（所有模式都注入）
    // ==========================================
    const brandContext = `品牌名称：${kb.brand.name}
品牌故事：${kb.brand.story}
品牌愿景：${kb.brand.vision}
核心价值观：${kb.brand.core_values.join('、')}`;

    // 只有"养生科普"类别才注入完整创始人背书
    // 其他种草类别（品牌整体、草本茶饮、草本咖啡、探店打卡、生活方式）不注入
    const shouldInjectFounder = category === 'health';

    const founderAuthority = shouldInjectFounder
      ? `创始人：${kb.founder.name}\n核心背书：25年液态灵芝产业化专家。\n背景：${kb.founder.background}`
      : '（当前为种草内容方向，不使用创始人背书，聚焦产品体验和用户痛点）';

    // ==========================================
    // 2. 构建【产品/品牌上下文】（根据模式不同）
    // ==========================================
    let context = "";
    let ingredientsContext = "无";
    let targetAudienceContext = "";

    if (mode === 'brand') {
      // 品牌级口感优势
      const brandTaste = (kb.brand as any).taste_advantage;
      const tasteContext = brandTaste
        ? `\n品牌核心口感优势：\n- 对比奶茶：${brandTaste.vs_milk_tea.summary}（${brandTaste.vs_milk_tea.details.slice(0,2).join('；')}）\n- 对比中药：${brandTaste.vs_traditional_herbal.summary}（${brandTaste.vs_traditional_herbal.details.slice(0,2).join('；')}）\n- 技术支撑：${brandTaste.technology_advantage}`
        : '';

      context = `品牌模式 - 聚焦品牌整体内容策略
产品矩阵概览：
${kb.products.map(p => `- ${p.name}：${p.function}`).join('\n')}${tasteContext}`;

      ingredientsContext = "品牌核心原料：灵芝发酵液（基底）+ 各系列功能性草本成分";
      targetAudienceContext = BRAND_GENERAL_PERSONAS;

    } else if (mode === 'product') {
      const product = kb.products.find(p => p.id === productId || p.name === productId);
      if (!product) {
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }

      // 产品级口感优势
      const productTaste = (product as any).taste_advantage;
      const productTasteContext = productTaste
        ? `\n产品口感核心卖点：\n${productTaste.core_selling_points.slice(0,3).join('\n')}\n核心话术：${productTaste.key_phrases.slice(0,2).join('、')}`
        : '';

      context = `产品模式 - 聚焦单品推广
产品名称：${product.name}
产品功能：${product.function}
价值主张：${product.value_proposition}${productTasteContext}
⚠️ 重要：所有内容支柱必须严格围绕"${product.name}"，禁止提及其他产品。`;

      ingredientsContext = product.ingredients || "暂无详细配方";
      // 产品模式：使用产品画像，如无则使用通用画像兜底
      const universalPersonas = (kb.brand as any).universal_personas;
      targetAudienceContext = product.personas
        ? product.personas.map((p: any) => `${p.role}：痛点包括${p.pain_points.slice(0, 2).join('、')}`).join('\n')
        : (product.target_audience || (universalPersonas
            ? universalPersonas.slice(0,2).map((p: any) => `${p.type}（${p.age}）：${p.pain_points.slice(0,2).join('、')}`).join('\n')
            : "都市健康消费人群"));
    }

    const categoryDesc = CATEGORY_CONTEXT[category] || CATEGORY_CONTEXT['brand'];

    // ==========================================
    // 3. 填充提示词占位符
    // ==========================================
    const systemPrompt = prompts.pillars_system;
    let userPrompt = (prompts.pillars_user || '')
      .replace('{{mode}}', mode === 'brand' ? '品牌整体策略' : '单品推广策略')
      .replace('{{brand_context}}', brandContext)
      .replace('{{founder_authority}}', founderAuthority)
      .replace('{{context}}', context)
      .replace('{{ingredients}}', ingredientsContext)
      .replace('{{target_audience}}', targetAudienceContext)
      .replace('{{category}}', categoryDesc);

    if (category !== 'health') {
      userPrompt += `\n\n**【种草阶段约束 — 必须遵守】**
❌ 禁止生成与创始人个人经历相关的支柱（如"25年深耕"、"第四代灵芝"、"亿元退出"）
❌ 禁止生成过于宏大的品牌叙事支柱（如"产业革命"、"技术突破"）
✅ 支柱必须从用户视角出发：用户的痛点是什么？用户喝完有什么感受？用户的生活场景是什么？
✅ 好的种草支柱示例：「奶茶替代计划」「下午三点的续命水」「不苦的养生新方式」「告别早起水肿脸」
❌ 不好的支柱示例：「25载深耕的第四代灵芝」「液态发酵技术革命」「创始人的灵芝梦」`;
    }

    // ==========================================
    // 3.5 注入创意种子，避免每次生成相同的支柱
    // ==========================================
    const creativitySeeds = [
      '本次请特别从「年轾Z世代」视角出发，支柱要体现潮流感和社交属性。',
      '本次请特别从「职场效率」视角出发，支柱要体现时间价值和便捷性。',
      '本次请特别从「口感革命」视角出发，支柱要体现味觉体验和传统突破。',
      '本次请特别从「女性自我关怀」视角出发，支柱要体现情绪价值和仪式感。',
      '本次请特别从「科技养生」视角出发，支柱要体现现代技术和传统智慧的融合。',
      '本次请特别从「社交货币」视角出发，支柱要体现分享欲和话题性。',
      '本次请特别从「对比传统」视角出发，支柱要体现与传统中药/奶茶的差异。',
      '本次请特别从「场景渗透」视角出发，支柱要体现不同生活场景的切入。',
      '本次请特别从「信任建立」视角出发，支柱要体现专业背书和用户证言。',
      '本次请特别从「健康焦虑」视角出发，支柱要体现亚健康人群的痛点和解决方案。',
    ];
    const seed = creativitySeeds[Math.floor(Math.random() * creativitySeeds.length)];
    const now = new Date();
    const timeContext = `当前时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${['周日','周一','周二','周三','周四','周五','周六'][now.getDay()]}）`;
    const enhancedUserPrompt = userPrompt +
      `\n\n**[本次创意方向种子]**\n${seed}\n${timeContext}\n请确保生成的支柱与之前可能生成的结果有明显差异。`;

    // ==========================================
    // 4. 调用 AI
    // ==========================================
    const openai = createAIClient(request);
    const modelName = getModelName(request);
    const provider = getProvider(request);
    const reasoning = isReasoningModel(modelName);
    const jsonUnsupported = isJsonFormatUnsupported(modelName, provider);
    const needsPromptJson = reasoning || jsonUnsupported;

    const enhancedSystemPrompt = systemPrompt +
      `\n\n**当前话题类别聚焦**：${categoryDesc}\n请确保生成的内容支柱紧密围绕此类别方向，使选题更精准。`;

    const finalSystemPrompt = needsPromptJson
      ? enhancedSystemPrompt + '\n\n**IMPORTANT: You MUST respond with valid JSON only. No markdown, no extra text. Output the raw JSON object directly.**'
      : enhancedSystemPrompt;

    const completionParams: any = {
      model: modelName,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: enhancedUserPrompt },
      ],
    };

    if (!needsPromptJson) {
      completionParams.response_format = { type: 'json_object' };
    }

    const completion = await openai.chat.completions.create(completionParams);
    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content received from AI");

    const result = JSON.parse(cleanJsonResponse(content));

    // 兼容处理：如果AI返回的pillars是字符串数组（旧格式），转换为新格式
    if (result.pillars && Array.isArray(result.pillars)) {
      result.pillars = result.pillars.map((p: any) => {
        if (typeof p === 'string') {
          return { pillar: p, source: 'A-痛点', rationale: '' };
        }
        return p;
      });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error generating pillars:", error);
    if (error.message === 'NO_API_KEY_CONFIGURED') {
      return NextResponse.json(
        { error: "请先配置 AI 模型", details: "请点击右上角设置图标，填写 API Key 后再试。" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate pillars", details: error.message },
      { status: 500 }
    );
  }
}

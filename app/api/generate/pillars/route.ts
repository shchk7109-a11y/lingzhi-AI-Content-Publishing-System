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

    const founderAuthority = `创始人：${kb.founder.name}
核心背书：25年一直致力于液态灵芝产业化，是第四代灵芝的倡导者。
背景：${kb.founder.background}`;

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
    const userPrompt = (prompts.pillars_user || '')
      .replace('{{mode}}', mode === 'brand' ? '品牌整体策略' : '单品推广策略')
      .replace('{{brand_context}}', brandContext)
      .replace('{{founder_authority}}', founderAuthority)
      .replace('{{context}}', context)
      .replace('{{ingredients}}', ingredientsContext)
      .replace('{{target_audience}}', targetAudienceContext)
      .replace('{{category}}', categoryDesc);

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
        { role: 'user', content: userPrompt },
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

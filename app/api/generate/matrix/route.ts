import { NextResponse } from 'next/server';
import { createAIClient, getModelName, getProvider, isReasoningModel, isJsonFormatUnsupported, cleanJsonResponse } from '@/lib/ai-client';
import { getKnowledgeBase } from '@/lib/knowledge-server';
import { getPrompts } from '@/lib/prompts';

// 品牌模式下的通用客户画像（跨产品）
const BRAND_GENERAL_PERSONAS = `都市健康消费人群（三类核心画像）：
1. 朋克养生白领（25-35岁）：工作节奏快，关注健康但无暇炖煮，追求"好喝+有效"的日常养生。痛点：喝咖啡提神但怕伤胃；想养生但没时间。
2. 精致妈妈/女性精英（30-40岁）：注重气色与抗老，对成分敏感，追求"内调外养"。痛点：气色差、睡眠浅、精力不足，但不想吃药。
3. 银发新青年/健康前瞻者（40-55岁）：主动管理健康，认可传统草本价值，对技术背书有较高信任需求。痛点：慢性疲劳、免疫力下降，寻找有科学依据的养生方案。`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pillars, mode = 'brand', productId } = body;

    if (!pillars || !Array.isArray(pillars) || pillars.length !== 3) {
      return NextResponse.json(
        { error: "Invalid input. Must provide exactly 3 pillars as an array." },
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
    let ingredientsContext = "无（品牌模式）";
    let personasContext = "";

    if (mode === 'product' && productId) {
      const product = kb.products.find(p => p.name === productId || p.id === productId);

      if (product) {
        context = `产品模式 - 聚焦单品推广
产品名称：${product.name}
产品功能：${product.function}
价值主张：${product.value_proposition}
⚠️ 重要：9宫格所有创意必须严格围绕"${product.name}"，禁止提及其他产品。`;

        ingredientsContext = product.ingredients || "暂无配方数据";

        personasContext = product.personas
          ? product.personas.map((p: any, i: number) => `
【画像 ${i + 1}: ${p.role}】
- 核心痛点：${p.pain_points.join('；')}
- 未解决原因：${p.unsolved_reasons.join('；')}
- 常见异议：${p.objections.join('；')}
- 营销切入点：${p.marketing_angles.join('；')}`).join('\n')
          : BRAND_GENERAL_PERSONAS;
      } else {
        context = "未找到指定产品，将使用通用品牌信息生成。";
        personasContext = BRAND_GENERAL_PERSONAS;
      }
    } else {
      // 品牌模式
      context = `品牌模式 - 聚焦品牌整体内容策略
产品矩阵概览：
${kb.products.map(p => `- ${p.name}：${p.function}`).join('\n')}`;

      ingredientsContext = "品牌核心原料：灵芝发酵液（基底）+ 各系列功能性草本成分";
      personasContext = BRAND_GENERAL_PERSONAS;
    }

    // ==========================================
    // 3. 解析支柱信息（兼容新格式对象和旧格式字符串）
    // ==========================================
    const parsePillar = (p: any): { name: string; source: string } => {
      if (typeof p === 'string') return { name: p, source: 'A-痛点' };
      if (typeof p === 'object' && p.pillar) return { name: p.pillar, source: p.source || 'A-痛点' };
      return { name: String(p), source: 'A-痛点' };
    };

    const pillar1 = parsePillar(pillars[0]);
    const pillar2 = parsePillar(pillars[1]);
    const pillar3 = parsePillar(pillars[2]);

    // ==========================================
    // 4. 填充提示词占位符
    // ==========================================
    const systemPrompt = prompts.matrix_system;
    const userPrompt = (prompts.matrix_user || '')
      .replace('{{mode}}', mode === 'brand' ? '品牌模式' : '产品模式')
      .replace('{{brand_context}}', brandContext)
      .replace('{{founder_authority}}', founderAuthority)
      .replace('{{context}}', context)
      .replace('{{personas_context}}', personasContext)
      .replace('{{ingredients}}', ingredientsContext)
      .replace('{{pillar1}}', pillar1.name)
      .replace('{{pillar2}}', pillar2.name)
      .replace('{{pillar3}}', pillar3.name)
      .replace('{{source1}}', pillar1.source)
      .replace('{{source2}}', pillar2.source)
      .replace('{{source3}}', pillar3.source);

    // ==========================================
    // 5. 调用 AI
    // ==========================================
    const openai = createAIClient(request);
    const modelName = getModelName(request);
    const provider = getProvider(request);
    const reasoning = isReasoningModel(modelName);
    const jsonUnsupported = isJsonFormatUnsupported(modelName, provider);
    const needsPromptJson = reasoning || jsonUnsupported;

    const finalSystemPrompt = needsPromptJson
      ? systemPrompt + '\n\n**IMPORTANT: You MUST respond with valid JSON only. No markdown, no extra text. Output the raw JSON object directly.**'
      : systemPrompt;

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
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error generating matrix:", error);
    if (error.message === 'NO_API_KEY_CONFIGURED') {
      return NextResponse.json(
        { error: "请先配置 AI 模型", details: "请点击右上角设置图标，填写 API Key 后再试。" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate matrix", details: error.message },
      { status: 500 }
    );
  }
}

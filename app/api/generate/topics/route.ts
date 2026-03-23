import { NextResponse } from 'next/server';
import { createAIClient, getModelName, getProvider, isReasoningModel, isJsonFormatUnsupported, cleanJsonResponse } from '@/lib/ai-client';
import { getPrompts } from '@/lib/prompts';
import { getKnowledgeBase } from '@/lib/knowledge-server';

/**
 * 构建口感优势上下文字符串，整合品牌级和产品级口感数据
 * 对应 PDF 方案中的「口感差异化矩阵」和「产品线口感特色」
 */
function buildTasteAdvantageContext(kb: ReturnType<typeof getKnowledgeBase>): string {
  const lines: string[] = [];

  // 品牌级口感优势
  const ta = kb.brand.taste_advantage;
  if (ta) {
    lines.push('【品牌口感差异化矩阵】');
    if (ta.core_positioning) {
      lines.push(`核心口感定位：${ta.core_positioning}`);
    }
    if (ta.vs_milk_tea?.summary) {
      lines.push(`对比奶茶：${ta.vs_milk_tea.summary}`);
      if (ta.vs_milk_tea.details?.length) {
        lines.push(`  详细优势：${ta.vs_milk_tea.details.join(' | ')}`);
      }
    }
    if (ta.vs_traditional_herbal?.summary) {
      lines.push(`对比传统草本：${ta.vs_traditional_herbal.summary}`);
      if (ta.vs_traditional_herbal.details?.length) {
        lines.push(`  详细优势：${ta.vs_traditional_herbal.details.join(' | ')}`);
      }
    }
    if (ta.technology_advantage) {
      lines.push(`技术/工艺优势：${ta.technology_advantage}`);
    }
    if (ta.brand_promise) {
      lines.push(`品牌口感承诺：${ta.brand_promise}`);
    }
  }

  // 产品级口感特色
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

  // 通用口感话术库（来自 PDF 5.3 节）
  lines.push('\n【通用口感话术库】');
  lines.push('草本茶饮：「无苦涩，有回甘，像喝甜品一样」「入口柔和，没有中药感，但有淡淡回甘」「比中药好喝，有效成分更多」');
  lines.push('草本咖啡：「不改喝咖啡的习惯，增加了养生功效」「咖啡师都喝不出加了草本」「入口是熟悉的美式，回味是温润的甘甜」');
  lines.push('通用：「良药与甜品的和解」「比奶茶健康，味道差不多」「每杯口感一致，标准化更安全」');

  return lines.length > 0 ? lines.join('\n') : '（暂无口感优势数据，请在知识库管理页面填写）';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matrix, platform = 'video' } = body;

    if (!matrix || !Array.isArray(matrix) || matrix.length === 0) {
      return NextResponse.json(
        { error: "Invalid input. Must provide a valid matrix array." },
        { status: 400 }
      );
    }

    const kb = getKnowledgeBase();
    const prompts = getPrompts();
    
    // 构建口感优势上下文（PDF 方案核心数据）
    const tasteAdvantageContext = buildTasteAdvantageContext(kb);

    // Get correct platform skill
    let platformSkill = "";
    if (platform === 'xiaohongshu') platformSkill = prompts.skills_xhs;
    else if (platform === 'wechat') platformSkill = prompts.skills_wechat;
    else platformSkill = prompts.skills_video;

    // Inject Ingredients and Taste Advantage into platform Skills
    const ingredientsContext = kb.products.map(p => `${p.name}: ${p.ingredients || 'Unknown'}`).join('; ');
    platformSkill = platformSkill
      .replace(/\{\{ingredients\}\}/g, ingredientsContext)
      .replace(/\{\{taste_advantage\}\}/g, tasteAdvantageContext);

    const quantityInstruction = platform === 'video' 
        ? "Generate 3 video titles/hooks per cell." 
        : "Generate **5 distinct titles/copy angles** per cell. Keep them concise but catchy.";

    // Build System Prompt — inject taste_advantage into topics_system as well
    let systemPrompt = prompts.topics_system
        .replace('{{brand_name}}', kb.brand.name)
        .replace('{{platform_skills}}', platformSkill)
        .replace('{{quantity_instruction}}', quantityInstruction)
        .replace('{{taste_advantage}}', tasteAdvantageContext);

    // Build User Prompt
    const userPrompt = prompts.topics_user
        .replace('{{platform}}', platform)
        .replace('{{matrix_json}}', JSON.stringify(matrix, null, 2));

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
    if (!content) {
      throw new Error("No content received from AI");
    }

    const result = JSON.parse(cleanJsonResponse(content));
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error generating topics:", error);
    if (error.message === 'NO_API_KEY_CONFIGURED') {
      return NextResponse.json(
        { error: "请先配置 AI 模型", details: "请点击右上角设置图标，填写 API Key 后再试。" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate topics", details: error.message },
      { status: 500 }
    );
  }
}

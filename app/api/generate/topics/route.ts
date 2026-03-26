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

function getSeasonContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const solarTerms: Array<{name: string, month: number, startDay: number}> = [
    {name: '小寒', month: 1, startDay: 6},
    {name: '大寒', month: 1, startDay: 20},
    {name: '立春', month: 2, startDay: 4},
    {name: '雨水', month: 2, startDay: 19},
    {name: '惊蛰', month: 3, startDay: 6},
    {name: '春分', month: 3, startDay: 21},
    {name: '清明', month: 4, startDay: 5},
    {name: '谷雨', month: 4, startDay: 20},
    {name: '立夏', month: 5, startDay: 6},
    {name: '小满', month: 5, startDay: 21},
    {name: '芒种', month: 6, startDay: 6},
    {name: '夏至', month: 6, startDay: 21},
    {name: '小暑', month: 7, startDay: 7},
    {name: '大暑', month: 7, startDay: 23},
    {name: '立秋', month: 8, startDay: 7},
    {name: '处暑', month: 8, startDay: 23},
    {name: '白露', month: 9, startDay: 8},
    {name: '秋分', month: 9, startDay: 23},
    {name: '寒露', month: 10, startDay: 8},
    {name: '霜降', month: 10, startDay: 23},
    {name: '立冬', month: 11, startDay: 7},
    {name: '小雪', month: 11, startDay: 22},
    {name: '大雪', month: 12, startDay: 7},
    {name: '冬至', month: 12, startDay: 22},
  ];

  let currentTerm = '春分';
  for (let i = solarTerms.length - 1; i >= 0; i--) {
    const term = solarTerms[i];
    if (month > term.month || (month === term.month && day >= term.startDay)) {
      currentTerm = term.name;
      break;
    }
  }

  const seasons: Record<string, string> = {
    '1': '冬季（寒冷干燥，适合温补暖身）',
    '2': '冬末春初（乍暖还寒，注意养肝）',
    '3': '春季（万物复苏，适合祛湿养肝，易犯春困）',
    '4': '春季（雨水多，湿气重，适合祛湿排毒）',
    '5': '初夏（气温升高，适合清热降火）',
    '6': '夏季（炎热潮湿，适合消暑祛湿）',
    '7': '盛夏（高温，适合清凉饮品、提神醒脑）',
    '8': '夏末秋初（秋燥将至，适合润燥养阴）',
    '9': '秋季（干燥，适合润肺养阴、补气血）',
    '10': '深秋（寒凉，适合温补暖身）',
    '11': '初冬（开始进补，适合温阳驱寒）',
    '12': '冬季（适合温补肾阳、驱寒暖身）',
  };

  return `当前节气：${currentTerm}；${seasons[String(month)] || '春季'}`;
}

function getSceneContext(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const scenes: Record<number, string> = {
    1: '周一开工日（需要提神续命、对抗"上班恐惧症"）',
    2: '周二工作日（进入节奏，适合效率型内容）',
    3: '周三小周末（一周过半，适合犒劳自己）',
    4: '周四（快到周末了，适合期待型内容）',
    5: '周五收工日（犒劳自己、下班仪式感）',
    6: '周六休闲日（慢生活、探店、独处时光）',
    0: '周日充电日（为下周准备、提前养生）',
  };
  return scenes[dayOfWeek] || '工作日';
}

function buildPersonasAndAnglesContext(kb: ReturnType<typeof getKnowledgeBase>): string {
  const lines: string[] = [];

  for (const product of kb.products) {
    if (!product.personas || product.personas.length === 0) continue;

    lines.push(`\n【${product.name}（${product.category}）— ${product.function}】`);

    for (const persona of product.personas) {
      lines.push(`  目标人群：${persona.role}`);
      lines.push(`  核心痛点：${persona.pain_points.slice(0, 3).join('；')}`);
      lines.push(`  选题灵感（营销切入点）：${persona.marketing_angles.slice(0, 3).join('；')}`);
      lines.push(`  常见疑问：${persona.objections.slice(0, 2).join('；')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matrix, platform = 'video' } = body;
    const topicsPerIdea = Math.min(Math.max(body.topicsPerIdea || 2, 1), 3); // 1-3，默认2

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
    // 每个产品只取前3-4个主要原料，避免标题中出现完整原料列表
    const ingredientsContext = kb.products.map(p => {
      const allIngredients = (p.ingredients || 'Unknown').split(/[\s、，,]+/).filter((i: string) => i.trim().length > 0);
      const mainIngredients = allIngredients.slice(0, 3).join('、');
      return `${p.name}: ${mainIngredients}${allIngredients.length > 3 ? '等' : ''}`;
    }).join('; ');
    platformSkill = platformSkill
      .replace(/\{\{ingredients\}\}/g, ingredientsContext)
      .replace(/\{\{taste_advantage\}\}/g, tasteAdvantageContext);

    const totalPerCell = topicsPerIdea * 2; // 每格2个创意 × 每个创意N个选题
    const quantityInstruction = platform === 'video'
        ? `Generate ${totalPerCell} video titles/hooks per cell.`
        : `Generate ${totalPerCell} distinct titles/copy angles per cell. Keep them concise but catchy.`;

    // Build System Prompt — inject taste_advantage into topics_system as well
    let systemPrompt = prompts.topics_system
        .replace('{{brand_name}}', kb.brand.name)
        .replace('{{platform_skills}}', platformSkill)
        .replace('{{quantity_instruction}}', quantityInstruction)
        .replace('{{taste_advantage}}', tasteAdvantageContext);

    // 追加 personas 上下文（通用流程，所有平台受益）
    const personasForTopics = buildPersonasAndAnglesContext(kb);
    systemPrompt = systemPrompt +
      '\n\n**【用户画像与痛点素材库（生成选题时必须参考）】**\n' +
      personasForTopics;

    // 短视频选题可以包含创始人相关方向
    if (platform === 'video') {
      systemPrompt = systemPrompt +
        '\n\n**【创始人故事素材（短视频专用选题方向）】**\n' +
        `创始人${kb.founder.name}：25年液态灵芝专家，曾实现1亿元品牌退出。\n` +
        '可围绕创始人经历生成权威背书类选题，如："25年只做一件事的人，做出了什么样的饮品"';
    }

    // Build User Prompt
    let userPrompt = prompts.topics_user
        .replace('{{platform}}', platform)
        .replace('{{matrix_json}}', JSON.stringify(matrix, null, 2));

    // ======= 小红书专用分支 =======
    if (platform === 'xiaohongshu') {
      const xhsSystemTemplate = prompts.topics_system_xhs;
      const xhsUserTemplate = prompts.topics_user_xhs;

      // 如果配置了小红书专用prompt，覆盖通用prompt
      if (xhsSystemTemplate && xhsUserTemplate) {
        // 构建产品矩阵摘要
        const productMatrix = kb.products.map(p =>
          `${p.name}（${p.category}）：${p.function} | 配方关键成分：${(p.ingredients || '').split(/\s+/).slice(0, 4).join('、')}`
        ).join('\n');

        // 构建 personas 上下文
        const personasAndAngles = buildPersonasAndAnglesContext(kb);

        // 构建支柱列表和矩阵摘要
        const pillarsList = matrix.map((row: any, i: number) =>
          `${i+1}. ${row.pillar}`
        ).join('\n');

        const matrixSummary = matrix.map((row: any) =>
          `「${row.pillar}」→ 增长策略：${row.growth?.title || ''} | 知识策略：${row.knowledge?.title || ''} | 权威策略：${row.authority?.title || ''}`
        ).join('\n');

        // 填充 system prompt（动态数量替换）
        const xhsPerCategory = topicsPerIdea * 2; // 每类数量 = 每个创意N个 × 2个创意
        const xhsTotalPerPillar = xhsPerCategory * 4; // 4类 × 每类数量
        systemPrompt = xhsSystemTemplate
          .replace(/每类 3 个/g, `每类 ${xhsPerCategory} 个`)
          .replace(/共 12 个\/支柱/g, `共 ${xhsTotalPerPillar} 个/支柱`)
          .replace(/\{\{season_context\}\}/g, getSeasonContext())
          .replace(/\{\{scene_context\}\}/g, getSceneContext())
          .replace(/\{\{product_matrix\}\}/g, productMatrix)
          .replace(/\{\{taste_advantage\}\}/g, tasteAdvantageContext)
          .replace(/\{\{brand_name\}\}/g, kb.brand.name)
          .replace(/\{\{personas_and_angles\}\}/g, personasAndAngles);

        // 填充 user prompt
        userPrompt = xhsUserTemplate
          .replace(/\{\{pillars_list\}\}/g, pillarsList)
          .replace(/\{\{matrix_summary\}\}/g, matrixSummary);
      }
    }
    // ======= 其他平台保持原有逻辑 =======

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

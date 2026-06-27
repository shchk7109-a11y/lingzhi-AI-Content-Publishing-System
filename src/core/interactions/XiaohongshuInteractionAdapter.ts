import type { Page } from 'puppeteer-core'
import type { XiaohongshuAction } from '../../shared/task-package'

export type InteractionAction = Exclude<XiaohongshuAction, 'publish'>

export interface InteractionInput {
  page: Page
  action: InteractionAction
  targetUrl: string
  commentText?: string
}

export interface InteractionStep {
  step: string
  success: boolean
  error?: string
}

export interface InteractionResult {
  success: boolean
  steps: InteractionStep[]
}

interface InteractionBehavior {
  randomDelay(minMs: number, maxMs: number): Promise<void>
  humanScroll?(page: Page, scrollCount: number): Promise<void>
}

const INTERACTION_ACTIONS = ['comment', 'favorite', 'collect', 'browse'] as const satisfies readonly InteractionAction[]

export class XiaohongshuInteractionAdapter {
  constructor(private readonly behavior: InteractionBehavior) {}

  async run(input: InteractionInput): Promise<InteractionResult> {
    const targetUrl = this.validateInput(input)
    const steps: InteractionStep[] = []

    try {
      await input.page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })
      steps.push({ step: 'navigate_target', success: true })
      await this.behavior.randomDelay(2000, 4000)
    } catch (error) {
      steps.push({
        step: 'navigate_target',
        success: false,
        error: this.errorMessage(error)
      })
      return { success: false, steps }
    }

    if (input.action === 'browse') {
      try {
        await this.behavior.humanScroll?.(input.page, 1)
        steps.push({ step: 'browse_target', success: true })
        return { success: true, steps }
      } catch (error) {
        steps.push({
          step: 'browse_target',
          success: false,
          error: this.errorMessage(error)
        })
        return { success: false, steps }
      }
    }

    steps.push({ step: `${input.action}_queued_for_selector_mapping`, success: true })
    return { success: true, steps }
  }

  private validateInput(input: InteractionInput): string {
    const action = input.action as XiaohongshuAction
    if (action === 'publish') {
      throw new Error('publish action is not accepted by interaction adapter')
    }
    if (!INTERACTION_ACTIONS.includes(action as InteractionAction)) {
      throw new Error(`unsupported interaction action: ${action}`)
    }
    if (action === 'comment' && !input.commentText?.trim()) {
      throw new Error('comment_text is required for comment action')
    }

    const targetUrl = input.targetUrl.trim()
    if (!targetUrl) {
      throw new Error('targetUrl is required')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(targetUrl)
    } catch {
      throw new Error('targetUrl must be an http or https URL')
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('targetUrl must be an http or https URL')
    }

    return targetUrl
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * 脚本输入节点
 */

import { BaseNodeClass } from '../node/BaseNode'
import { ExecutionContext } from '../types'

export class ScriptInputNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'script-input',
      name: '脚本输入',
      description: '输入脚本内容',
      ...config
    })
  }

  getParamSchema() {
    return {
      script: {
        type: 'string',
        required: true,
        default: '',
        description: '脚本内容'
      },
      description: {
        type: 'string',
        required: false,
        default: '',
        description: '脚本描述'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    const script = this.params.script || ''
    return { type: 'text', content: script }
  }
}

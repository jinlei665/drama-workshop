/**
 * 脚本输入节点
 */

import { BaseNodeClass } from '../node/BaseNode'
import { ExecutionContext } from '../types'

const SCRIPT_INPUT_PORTS = {
  inputs: [],
  outputs: [{ id: 'script', name: '脚本' }]
}

export class ScriptInputNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'script-input',
      name: '脚本输入',
      description: '输入脚本内容',
      inputs: SCRIPT_INPUT_PORTS.inputs,
      outputs: SCRIPT_INPUT_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      script: {
        type: 'string',
        required: false,
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

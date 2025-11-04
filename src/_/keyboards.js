import Module from '../module.js'
import { isAdmin } from '../utils/chats.js'
import { bot } from '../index.js'

class KeyboardModule extends Module {
    description = "Модуль клавиатур"
    priority = 35
    
    async onCallback(ctx, next) {
        next()
    }
}

export default KeyboardModule

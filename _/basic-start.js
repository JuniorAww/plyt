import { Markup } from 'telegraf'
import Module from '../module.js'

class StartModule extends Module {
    description = "Типичный ответ на /start"
    priority = 100
    
    async onStart(ctx, next) {
        if (!startStickers.values) await retrieveStickers(ctx)
        
        await ctx.reply(`🍄 <b>Приветствую!</b>\nЯ - мультимодальный бот, полезный для чатов и не только. <i>Что бы вы хотели узнать?</i>`, startKeyboard());
        
        if (startStickers.values) await ctx.sendSticker(pickSticker())
    }
}

const startStickers = { values: null, retrieving: false }

const startKeyboard = () => Markup.inlineKeyboard([
    [ Markup.button.callback('💫 Мой профиль', 'menu me') ],
    [ Markup.button.callback('🌟 Языковой тренер', 'menu trainer') ],
])

/* Вспомогательное: стикеры по команде /start */
const pickSticker = () => startStickers.values[Math.floor(Math.random() * startStickers.values.length)];

const retrieveStickers = async ctx => {
    if (!startStickers.retrieving) {
        startStickers.retrieving = true;
        const set = await ctx.telegram.getStickerSet('ImFoxFennec')
        startStickers.values = set.stickers.map(sticker => sticker.file_id)
        startStickers.retrieving = false;
    }
}

export default StartModule

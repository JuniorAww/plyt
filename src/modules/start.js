import { Panel, Keyboard, Callback } from "keygram";

const startPanel = Panel().Callback("⚙ Управляемые группы", "listGroups")
                          .Row()
                          .Callback("🦊 Получить лисичку", "sendFox")

// Start panel
export const onStart = async (ctx, reply) => {
    if (ctx.isGroup) return;
    const text = `🌟 <b>Приветик, ${ctx.from.first_name}</b>!`
               + `\nЯ - Плутовка, являюсь роболисой и помощницей для ваших чатов.`
               + `\nЧто бы вы хотели?`
    if (!stickers.length) await retrieveStickers(ctx.bot)
    if (!ctx.isCallback) await ctx.call('sendSticker', stickerParams())
    if (!reply) return ctx.respond(text, startPanel)
    else return ctx.reply(text, startPanel)
}

const startKeyboard = await Keyboard().Button("🌟 Главное меню", onStart).Build()

const stickerParams = () => {
    return {
        ...pickSticker(),
        reply_markup: startKeyboard
    }
}

let stickers = []

const pickSticker = () => ({
    sticker: stickers[Math.floor(Math.random() * stickers.length)]
});

const retrieveStickers = async bot => {
    const { result: set } = await bot.call('getStickerSet', { name: 'ImFoxFennec' })
    stickers = set.stickers.map(sticker => sticker.file_id)
}

export default {
    priority: 5,
    init: bot => {
        bot.on("/start", onStart)
        
        bot.register(onStart)
    }
}

import { Panel, Callback } from "../../keygram";

const startKeyboard = Panel().Callback("⚙ Управляемые группы", "listGroups")
                             .Row()
                             .Callback("🦊 Получить лисичку", "sendFox")

// Start panel
const onStart = async ctx => {
    const text = `🌟 <b>Приветик, ${ctx.from.first_name}</b>!`
               + `\nЯ - Плутовка, являюсь роболисой и помощницей для ваших чатов.`
               + `\nЧто бы вы хотели?`
    if (!stickers.length) await retrieveStickers(ctx.bot)
    await ctx.call('sendSticker', pickSticker())
    if (!ctx.isChat) await ctx.respond(text, startKeyboard)
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

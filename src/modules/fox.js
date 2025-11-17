import { Image, Panel, Callback } from "keygram";
import { onStart } from './start'

const sendFox = async (ctx, fox = ranfox()) => {
    const url = `https://randomfox.ca/images/${fox}.jpg`;
    const keyboard = Panel().Callback("🦊 Новая лисичка", sendFox, ranfox()).Row()
    
    if (!ctx.isGroup) keyboard.Callback("🌟 В главное меню", 'onStartFromFox')
    
    const text = "Ваша лисичка, сэр! <b>№" + fox + "</b>";
    return ctx.respond({ text, ...Image(url), keyboard })
}

const ranfox = () => Math.ceil(Math.random() * 124)

const onStartFromFox = ctx => {
    ctx.delete()
    return onStart(ctx, true)
}

export default {
    init: bot => {
        bot.text("/fox", sendFox)
        bot.register(sendFox, onStartFromFox)
    }
}


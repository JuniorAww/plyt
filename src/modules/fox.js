import { Image, Panel } from "../../keygram";

const sendFox = async (ctx, fox = 1) => {
    const url = `https://randomfox.ca/images/${fox}.jpg`;
    const next = Math.ceil(Math.random() * 124)
    const keyboard = Panel().Callback("🦊 Новая лисичка", sendFox, next)
    const text = "Ваша лисичка, сэр! <b>№" + fox + "</b>";
    
    return ctx.respond({ text, ...Image(url), keyboard })
}

export default {
    init: bot => {
        bot.text("/fox", sendFox)
        bot.register(sendFox)
    }
}


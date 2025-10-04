import Module from '../module.js'
import { isAdmin } from '../utils/chats.js'
import { users } from '../utils/data.js'
import { Input } from "telegraf";

class AwardsModule extends Module {
    description = "Награды в чатах"
    priority = 75
    
    async onMessage(ctx, next) {
        if (/^\/award (.*)/.test(ctx.text)) return await handleAward(ctx)
        next();
    }
}

let generating_for = false;
let generation_delay = 0;

const handleAward = async ctx => {
    if (ctx.chat.id > 0) return await ctx.reply("Команда доступна <b>в чатах!</b>")
    if (!await isAdmin(ctx)) return await ctx.react({ type: "emoji", emoji: "👎" })
    
    const prompt = ctx.text.slice(ctx.text.indexOf(' '));
    console.log(prompt)
    
    if (/[^A-Za-z ]/.test(prompt)) return await ctx.reply("Используйте только <b>латиницу!</b> (и правильно составьте предложение)")
    
    const reply = ctx.message.reply_to_message?.from;
    if (!reply) return await ctx.reply("Вы должны <b>ответить</b> на сообщение участника, которому хотите выдать награду!")
    if (reply.id === ctx.from.id) return await ctx.reply("Вы не можете выдать награду себе :(")
    if (reply.is_bot) return await ctx.reply("Вы не можете выдать награду боту :(")
    console.log(reply)
    
    const user = await users.getUser(ctx.message.reply_to_message);
    
    /* ограничиваем генерацию (в условиях бесплатного huggingface) */
    if (generating_for) return await ctx.reply("Команда уже выполняется для <b>" + generating_for.first_name + "</b>")
    if (generation_delay > Date.now()) return await ctx.reply("Пожалуйста, <b>подождите</b> немного!")
    
    generating_for = { ...ctx.from };
    
    await ctx.react({ type: "emoji", emoji: "👍" });
    
    try {
        const result = await query({
            response_format: "b64_json",
            prompt: "\"Award " + prompt + "\"",
            model: "stabilityai/stable-diffusion-xl-base-1.0"
        })
        
        const b64image = result.data[0].b64_json;
        const buffer = Buffer.from(b64image, "base64");
        
        const caption = `${reply.first_name}, вы получили <b>награду!</b>`
                      + `\nОна будет сохранена в вашем профиле`
                      + `\n<i>Изображение сгенерировано: stable-diffusion-xl-base-1.0</i>`
        const message = await ctx.replyWithPhoto({ source: buffer }, { caption, parse_mode: 'HTML' });
        const fileId = message.photo[message.photo.length - 1].file_id;
        
        if (!user.awards) user.awards = { list: [] }
        user.awards.list.push({
            chat: ctx.chat.id,
            _chat: ctx.chat.title,
            fileId,
            name: null,
            description: null
        })
    } catch (e) {
        console.log(e)
    } finally {
        generation_delay = Date.now() + 10 * 1000;
        generating_for = null;
    }
}

async function query(data) {
	const response = await fetch(
		"https://router.huggingface.co/nscale/v1/images/generations",
		{
			headers: {
				Authorization: `Bearer ${process.env.HUGGING_FACE}`,
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}




export default AwardsModule

import Module from '../module.js'
import { isAdmin } from '../utils/chats.js'
import { bot } from '../index.js'

class LevelsModule extends Module {
    description = "Уровни в чатах"
    priority = 100
    
    async onEverything(ctx, next) {
        
        if (ctx.chat.id < 0 && (!ctx.text || ctx.text[0] !== '/')) {
            await addExp(ctx)
        }
        
        next();
    }
    
    async onMessage(ctx, next) {
        if (ctx.text === '/me' || ctx.text === ('/me@' + bot.botInfo.username)) return await handleMe(ctx)
        else if (ctx.text === '/me reset') return await reset(ctx);
        else if (ctx.text === '/me resetall') return await resetAll(ctx);
        
        next()
    }
}

const handleMe = async ctx => {
    if (ctx.chat.id > 0) return await ctx.reply(`❌ Команда доступна <b>в чатах!</b>`);
    
    const chat = await ctx.getInfo();
  
    const levelInfo = chat.levels?.[ctx.from.id] || [ 0, 50, 0 ];
    const [ level, exp_left, exp_total ] = levelInfo;
    
    const text = `${ctx.from.first_name}, у вас <b>уровень ${toRoman(level + 1)}</b> (<b>${exp_left.toFixed(1)} EXP</b> до след. уровня!)`
    
    return await ctx.reply(text)
}

const reset = async ctx => {
    if (ctx.chat.id > 0) return await ctx.reply(`❌ Команда доступна <b>в чатах!</b>`);
    
    const chat = await ctx.getInfo();
    
    if (chat.levels) {
        delete chat.levels[ctx.from.id];
        await ctx.reply("Сброшено!")
    }
}

const resetAll = async ctx => {
    if (ctx.chat.id > 0) return await ctx.reply(`❌ Команда доступна <b>в чатах!</b>`);
    if (!await isAdmin(ctx)) return;
    
    const chat = await ctx.getInfo();
    
    if (chat.levels) {
        delete chat.levels;
        await ctx.reply("Сброшено!")
    }
}

// user.level = [ уровень, сколько_нужно_опыта, сколько_всего_опыта ]

async function addExp(ctx) {
    const chat = await ctx.getInfo();
    if (!chat.levels) chat.levels = {};
    
    const uid = +ctx.from.id;
    if (!chat.levels[uid]) chat.levels[uid] = [ 0, 50, 0 ];
    const level = chat.levels[uid];
    
    let givenExp = 0;
    
    if (ctx.text) {
        const len = ctx.text.length
        givenExp = +(0.1 + len > 30 ? 0.6 : (0.6 / 30 * len)).toFixed(2)
    }
    else if (ctx.photo) givenExp = 0.3;
    else if (ctx.video) givenExp = 0.75;
    else if (ctx.voice) givenExp = 1.25;
    else if (ctx.video_note) givenExp = 1.25 + ctx.video_note.duration / 60 * 2;
    else if (ctx.sticker) givenExp = 0.05;
    else if (ctx.audio) givenExp = 0.2;
    else givenExp = 0.15;
    
    level[1] = Math.floor(level[1] * 128 - givenExp * 128) / 128
    level[2] = Math.floor(level[2] * 128 + givenExp * 128) / 128
    
    if (level[1] <= 0) {
        level[0] ++;
        level[1] = Math.round(50 + level[0] * 25);
    }
}

/* Римские цифры */
const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];

export function toRoman(num) {
    let result = '';
    for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
}

export default LevelsModule

import Module from '../module.js'

class LevelsModule extends Module {
    description = "Уровни в чатах"
    priority = 50
    
    async onEverything(ctx, next) {
        
        if (ctx.chat.id < 0) {
            await addExp(ctx)
        }
        
        next();
    }
    
    async onMessage(ctx, next) {
        if (ctx.text === '/me') {
            const { level: Level } = await ctx.getUser();
            const [ level, exp_left, exp_total ] = Level;
            
            const text = `${ctx.from.first_name}, у вас <b>уровень ${toRoman(level + 1)}</b>\n⚡ Осталось <b>${exp_left.toFixed(1)} EXP</b> до нового уровня!`
            
            return await ctx.reply(text)
        }
        
        next()
    }
}

/* Как хранится опыт? */
// user.level = [ уровень, сколько_нужно_опыта, сколько_всего_опыта ]
// Почему array? Потому что шустрее и компактнее код, разобраться занимает ~ 10 секунд
// Зачем хранить сколько нужно опыта? Чтобы безболезненно обновлять формулу позднее
/* ================== */

async function addExp(ctx) {
    const { level } = await ctx.getUser();
    let givenExp = 0;
    
    if (ctx.text) {
        const len = ctx.text.length
        givenExp = +(0.1 + len > 30 ? 0.4 : (0.4 / 30 * len)).toFixed(2)
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

function toRoman(num) {
    let result = '';
    for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
}

export default LevelsModule

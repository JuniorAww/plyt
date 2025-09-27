import Module from '../module.js'

class AntiSpamModule extends Module {
    description = "Антиспам на приоритет > 20 (сложные команды)"
    priority = 20
    
    async onEverything(ctx, next) {
        const NOW = Date.now();
        const ID = ctx.from.id;
        
        if (spamblock[ID] > NOW) return;
        
        if (latestmsg[ID] > NOW - 500) {
            spamblock[ID] = NOW + 2000
            if(ctx.chat.id > 0 && ctx.message?.text) 
                await ctx.reply(`💫 <b>Пожалуйста, пишите реже ❤️</b>`
                              + `\nТак вы снижаете нагрузку на бота`, { parse_mode: 'HTML' });
            return;
        }
        
        latestmsg[ID] = NOW
        
        // Вынести с приоритетом 1
        if (ctx.message && ctx.message.date < (NOW / 1000 - 5)) {
            if(!aliveresp[ID]) {
                aliveresp[ID] = true;
                spamblock[ID] = NOW + 2000;
                if(ctx.chat.id > 0) await ctx.reply(`💫 <b>Бот снова доступен!</b>`);
            }
            return;
        }
        
        next();
    }
}

// WARNING засоряет глобальные переменные?
const spamblock = {}
const latestmsg = {}
const aliveresp = {}

export default AntiSpamModule

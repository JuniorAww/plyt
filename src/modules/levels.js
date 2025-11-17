import { Image, Panel } from "keygram";

const showLevel = async ctx => {
    if (!ctx.isGroup) return ctx.reply("Команда доступна только в чатах :(")
    const chat = await ctx.getChat()
    if (!chat.stats?.levels) return ctx.reply("К сожалению, уровни отключены админом :(")
    const stat = chat.stats?.list?.[ctx.from.id]?.level || [1, 50, 0];
    return ctx.call('sendMessage', {
        text: `У вас <b>${toRoman(stat[0])} уровень</b>!\n🔸 <b>Прогресс:</b> [${visexp(stat)}]`,
        reply_parameters: { message_id: ctx.update.message_id },
        parse_mode: 'HTML'
    })
}

const showTop = async ctx => {
    if (!ctx.isGroup) return ctx.reply("Команда доступна только в чатах :(")
    const chat = await ctx.getChat()
    if (!chat.stats?.levels) return ctx.reply("К сожалению, уровни отключены админом :(")
    const list = chat.stats.list
    const entries = Object.entries(list)
    const top = []
    for (let i = 0; i < Math.min(7, entries.length); i++) {
        let leader = [ null, 0 ];
        for (let [ userId, stat ] of entries) { 
            if (top.includes(userId)) continue;
            if (stat.level[2] > leader[1]) {
                leader = [ userId, stat.level[2] ]
            }
        }
        if (leader[0]) top.push(leader[0])
    }
    let result = [];
    let i = 0;
    for (const userId of top) {
        const user = await ctx.findUser(userId)
        if (!user) continue;
        i++
        const lvl = list[userId].level
        result.push(`${i}. ${user.name} (${toRoman(lvl[0])} уровень)`)
    }
    return ctx.call('sendMessage', {
        text: `<b>Держи!</b> Вот самые активные участники:\n${result.join('\n')}`,
        reply_parameters: { message_id: ctx.update.message_id },
        parse_mode: 'HTML'
    })
}

const visexp = level => {
    const req = Math.round(25 + level[0] * 25);
    const gained = req - level[1];
    let prog = Math.floor((gained / req) * 15);
    if (prog < 0) prog = 0;
    if (prog > 15) prog = 15;
    return ":".repeat(prog) + ".".repeat(15 - prog);
}

const chatMessageExp = async ctx => {
    if (!ctx.isGroup) return;
    
    const chat = await ctx.getChat()
    
    if (!chat.stats) chat.stats = {
        list: {},
        count: true,
        levels: true
    }

    const list = chat.stats.list

    if (!list[ctx.from.id]) list[ctx.from.id] = {
        level: [ 1, 50, 0 ],
        msg: {}
    }

    const entry = list[ctx.from.id]

    if (chat.stats.count) {
        const type = ctx.type
        if (!entry.msg[type]) entry.msg[type] = 1
        else entry.msg[type] += 1
    }

    if (!chat.stats.levels) return;

    let exp = 0;
    const upd = ctx.update;
    if (upd.text) {
        const len = upd.text.length
        exp = 0.1 + len > 30 ? 0.4 : (0.4 / 30 * len)
    }
    else if (upd.photo) exp = 0.3
    else if (upd.video) exp = 0.75
    else if (upd.voice) exp = 1.25
    else if (upd.video_note) exp = 1.25 + upd.video_node.duration / 60 * 2
    else if (upd.sticker) exp = 0.05
    else if (upd.audio) exp = 0.2

    if (exp) {
        const level = entry.level
        level[1] = +(level[1] - exp).toFixed(2)
        level[2] = +(level[2] + exp).toFixed(2)
        if (level[1] <= 0) {
            level[0] += 1
            level[1] = Math.round(25 + level[0] * 25)
            const user = await ctx.getUser()
            if (!user.items) user.items = { list: [] }
            const rarity = Math.ceil(Math.random() * 5)
            user.items.list.push({ type: 'chest', rarity })
            ctx.react("🎉")
        }
    }
}

const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];

function toRoman(num) {
    let result = '';
    for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
}

export default {
    priority: 50,
    init: bot => {
        bot.on('message', chatMessageExp)
        bot.text(/\/(me|me@plytbot)/, showLevel)
        bot.text(/\/(top|top@plytbot)/, showTop)
    }
}


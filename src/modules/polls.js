import { Panel, Callback, Text } from "keygram";
import { getChats } from './db'

const startPoll = async ctx => {
    if (!ctx.isGroup) return;
    const chat = await ctx.getChat()
    if (!chat.polls) chat.polls = { enabled: true, list: {} }
    
    const str = ctx.text.split('\n')
    if (str.length < 3) return false
    
    // "make poll for X hours"
    const [ _, __, ___, num, lim ] = str[0].split(' ')

    const time = getTime(num, lim)

    const vars = []
    for (let i = 2; i < str.length; i++) {
        const _var = str[i]
        let out = _var
        if (_var.match(/([0-9]+\.)/)) out = _var.slice(2).strip()
        vars.push(out)
    }
    
    const text = str[1];
    
    const id = btoa(Math.random().toString()).slice(6, 20)
    
    const buttons = Panel().Add(vars.map((_var, idx) => {
        return [ Callback(_var + ' (0)', "vote", id, idx) ]
    }))
    
    const { result: message } = await ctx.reply("<b>" + text + "</b>" + "\nГолосование завершится через " + format(time), buttons)
    
    chat.polls.list[id] = {
        text,
        vars,
        votes: {},
        author: { id: ctx.from.id, name: ctx.from.first_name },
        created: Math.floor(Date.now() / 1000),
        time,
        message: message.message_id
    }
    
    return true
}

export const finishPoll = async (bot, groupId, poll, admin) => {
    let text = `<b>${poll.text}</b>\n`
    if (admin) {
        const adminDisplay = !admin.first_name?.length ? ("@id" + admin.id) : 
                              `${admin.first_name}${admin.last_name?.length ? admin.last_name : ''}`
        text += `Голосование завершил ${adminDisplay}!`
    }
    else text += `Голосование завершено!`
    
    poll.finish = Math.floor(Date.now() / 1000)
    
    const Votes = Object.values(poll.votes)
    const topVoteId = +Object.entries(
        Object.values(poll.votes).reduce((acc, id) => {
            acc[id] = (acc[id] || 0) + 1;
            return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1])?.[0]?.[0];
    
    const reply_markup = Panel().Add(poll.vars.map((_var, idx) => {
        const votes = Votes.filter(x => x === idx).length
        return [ Text((topVoteId === idx ? '✅ ' : '') + _var + ` (${votes})`) ]
    })).Build()
    
    return await bot.call('editMessageText', {
        chat_id: groupId, message_id: poll.message, parse_mode: 'HTML', text, reply_markup
    })
}

const interval = bot => {
    const chats = getChats()
    
    setInterval(async () => {
        for (const id in chats) {
            const chat = chats[id]
            if (chat.polls) {
                for (const pollId in chat.polls.list) {
                    const poll = chat.polls.list[pollId]
                    if (poll.finish) continue
                    const left = poll.time - (Date.now() / 1000 - poll.created)
                    if (left < 0) {
                        await finishPoll(bot, id, poll)
                    }
                }
            }
        }
    }, 10000)
}

const vote = async (ctx, votingId, variantId) => {
    if (!ctx.isGroup) return;
    const chat = await ctx.getChat()
    if (!chat) return;
    
    const poll = chat.polls.list[votingId]
    if (!poll) return;
    
    if (poll.stopped) return ctx.answer("Голосование остановлено")
    
    if (poll.votes[ctx.from.id] === variantId) return ctx.answer("Вы уже проголосовали за это!")
    poll.votes[ctx.from.id] = variantId;
    
    const keyboard = Panel().Add(poll.vars.map((_var, idx) => {
        const votes = Object.values(poll.votes).filter(v => v === idx).length
        return [ Callback(_var + ` (${votes})`, "vote", votingId, idx) ]
    }))
    
    return ctx.edit(keyboard)
}

function getTime(num, lim) {
    if (!lim || !num) return NaN
    const amount = parseInt(num, 10)
    if (lim.startsWith('ч')) return amount * 60 * 60
    if (lim.startsWith('м')) return amount * 60
    if (lim.startsWith('с')) return amount
    if (lim.startsWith('д')) return amount * 60 * 60 * 24
    if (lim.startsWith('н')) return amonut * 60 * 60 * 24 * 7
    return NaN
}

export function format(time) {
    if (isNaN(time)) return 'неопределенное время'
    if (time > 60 * 60 * 24) {
        const d = Math.floor(time / 60 / 60 / 24)
        return d + (d === 1 ? ' день' : d > 1 && d < 5 ? ' дня' : ' дней')
    }
    if (time > 60 * 60) {
        const h = Math.floor(time / 60 / 60)
        return h + (h === 1 ? ' часов' : h > 1 && h < 5 ? ' часа' : ' часов')
    }
    if (time > 60) {
        const m = Math.floor(time / 60)
        return m + (m === 1 ? ' минуту' : m > 1 && m < 5 ? ' минуты' : ' минут')
    }
    const s = Math.floor(time)
    return s + (s === 1 ? ' секунду' : s > 1 && s < 5 ? ' секунды' : ' секунд')
}

export default {
    priority: 10,
    init: bot => {
        bot.text(/^Плут, голосование(.*)/i, startPoll)
        interval(bot)
        
        bot.register(startPoll, vote)
    }
}

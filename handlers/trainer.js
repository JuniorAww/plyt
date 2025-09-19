import { Markup } from 'telegraf'
import os from 'node:os'

const getCpuUsage = () => {
    try {
        const cpus = os.cpus();
        const cpu = cpus[0];
        
        const total = Object.values(cpu.times).reduce(
            (acc, tv) => acc + tv, 0
        );
        
        const usage = process.cpuUsage();
        const currentCPUUsage = (usage.user + usage.system) / 1000;
        
        return currentCPUUsage / total * 100;
    } catch (e) {
        console.error(e)
        return NaN
    }
}

async function askOllama(prompt, model = "gpt-oss:latest") {
    const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
        }),
    });

    if (!res.ok) {
        throw new Error(`Ollama error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.response;
}

const phrasesText = () => {
    return `You are a Spanish language learning assistant. Create ten phrases and word combinations related to the topic: "Study, school." Your interlocutor speaks Spanish at level B1 on the CERF scale. He is a russian. Always provide your answer in JSON, do not format:
{"phrases":[{"phrase":"Hola, gracias","translation":"Привет, спасибо"},{"phrase":"Donde esta la escuela?","translation":"Где школа?"}]}`
}

const cardsText = () => {
    return `You are a Spanish language learning assistant. Write 15 words on topics "Study, school" The person you're speaking to knows Spanish at level B1 on the CERF scale. He is a russian. Always provide your answer in JSON, do not format:
{"phrases":[{"phrase":"Hola, gracias","translation":"Привет, спасибо"},{"phrase":"Donde esta la escuela?","translation":"Где школа?"}]}`
}

const cardsText = () => {
    return `You are a Spanish language learning assistant. Write 15 words on topics "Study, school" The person you're speaking to knows Spanish at level B1 on the CERF scale. He is a russian. Always provide your answer in JSON, do not format:
{"phrases":[{"phrase":"Hola, gracias","translation":"Привет, спасибо"},{"phrase":"Donde esta la escuela?","translation":"Где школа?"}]}`
}

const topics = {
    es: {
        a2: {
            words: [
                "Семья, родственники", "Описание внешности, характера", "Ежедневная жизнь: распорядок, быт", "Дом, жильё (комнаты, мебель)", "Работа и профессии", "Учёба, школа", "Покупки, магазины", "Еда и напитки, рестораны", "Хобби, развлечения, спорт", "Путешествия, транспорт, ориентирование в городе", "Здоровье, болезни, посещение доктора", "Погода, времена года", "Одежда, аксессуары", "Отдых, мероприятия, праздники", "Время, дата, расписание", "Описание мест, атмосферы, окружающей среды", "Социальные взаимодействия: приглашения, предложения, разрешения, просьбы, выражение предпочтений", "Выражение эмоций, чувств, мнений"
            ],
            grammar: [
                "Настоящее время (Presente) — регулярные и нерегулярные глаголы", "Род и число существительных; согласование прилагательных с существительными", "Артикли (определённый, неопределённый, нулевой)", "Личные местоимения (yo, tú, él …)", "Возвратные глаголы (reflexivos)", "Прошлые времена: Pretérito Perfecto", "Прошлые времена: Pretérito Indefinido", "Прошлые времена: Pretérito Imperfecto", "Выражения времени с hace / desde / desde hace", "Сравнительная и превосходная степень прилагательных", "Простое будущее (perífrasis ir + a + infinitivo)", "Настоящее сослагательное наклонение (Presente de subjuntivo) в простых случаях", "Местоимения прямого дополнения (lo, la, los, las)", "Местоимения косвенного дополнения (le, les)", "Отрицание, двойное отрицание (no … nada / nadie / nunca)", "Вопросительные и восклицательные конструкции (qué, quién, cuándo, dónde … ¡qué …!)", "Предлоги (en, a, de, por, para и др.)", "Союзы / связки (y, o, pero, porque, así que, si и др.)", "Наречия места, времени, манеры (cómo, cuándo, dónde)", "Употребление ser vs estar", "Употребление por vs para", "Императив (tú, vosotros / ustedes) для команд и просьб", "Выражение обязательства / необходимости: tener que, hay que, deber + infinitivo"
            ]
        },
        b1: {
            words: [
                "comida y bebida", "viajes y transporte", "trabajo y profesiones", "educación", "salud y medicina", "clima y estaciones", "tecnología e internet", "compras y moda", "familia y relaciones", "ciudad y vivienda", "tiempo libre y hobbies", "finanzas y dinero", "cultura y tradiciones", "medio ambiente", "psicología y emociones", "temas sociales", "medios de comunicación", "estado y política", "animales y naturaleza", "fiestas y eventos"
            ],
            grammar: [
                "pretérito perfecto", "imperfecto", "pluscuamperfecto", "futuro próximo", "futuro simple", "condicional", "subjuntivo: deseos, dudas, necesidad", "condicionales tipo 1", "comparativos y superlativos", "pronombres directos e indirectos", "pronombres reflexivos", "pronombres enfatizadores", "pronombres relativos: que, quien, el cual/lo que", "posición de pronombres con infinitivo, gerundio y mandato afirmativo", "órdenes indirectas con subjuntivo", "apócope de adjetivos", "adverbios intensificadores: muy, bastante, demasiado", "oraciones complejas con conjunciones y conectores", "preposiciones de lugar y tiempo: en, a, por, para, desde, hasta, durante", "construcciones con lo que y lo cual", "uso de tampoco y ni", "preguntas complejas: cómo, qué, por qué"
            ]
        },
        b1: {
            words: [
                "Путешествия и транспорт", "Здоровье и медицина", "Образование и учёба", "Работа и профессии", "Покупки и потребление", "Культура и искусство", "Наука и технологии", "Экология и окружающая среда", "Общество и политика", "Семья и отношения", "Еда и напитки", "Праздники и традиции", "Спорт и досуг", "Медиа и коммуникации", "Глобализация и миграция", "Психология и эмоции", "Глобальные проблемы и вызовы", "История и культура испаноязычных стран", "География и климат", "Путеводители и путешествия"
            ],
            grammar: [
                "Сложные времена: Futuro perfecto, Condicional perfecto", "Сослагательное наклонение: presente de subjuntivo, imperfecto de subjuntivo, pluscuamperfecto de subjuntivo", "Условные предложения: tipo 2 (imperfecto de subjuntivo + condicional), tipo 3 (pluscuamperfecto de subjuntivo + condicional perfecto)", "Косвенная речь (estilo indirecto)", "Пассивный залог (voz pasiva)", "Глаголы с предлогами (verbos + preposición)", "Глаголы изменения состояния (verbos de cambio)", "Модальные глаголы (deber, poder, querer) в различных наклонениях", "Использование 'se' в различных конструкциях", "Порядок слов в сложных предложениях", "Сложные предложения с относительными, временными и причинными придаточными"
            ]
        }
    }
}

const queue = [];

const states = {};

export async function handleTrainer(ctx) {
    const text = `🧡 Языковой тренер\n<b>Выбранный язык:</b> Испанский\n<b>Ваш уровень: </b> B1`
    
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback('✅ Карточки', `trainer cards`),
        Markup.button.callback('✅ Фразы', `trainers phrases`) ],
        [ Markup.button.callback('✅ Говорение', `trainers audio`) ],
    ])
    
    await ctx.reply(text, keyboard)
}

const razdely = {
    cards: 'Карточки',
    phrases: 'Фразы',
    audio: 'Говорение',
}

export async function handleTrainerCallback(ctx, args) {
    const keyboard = Markup.inlineKeyboard([
        [ Markup.button.callback(`✨ Ожидайте!`, `wait`) ],
    ])
    
    await ctx.editMessageText(`✨ Вы выбрали раздел "${razdely[args[1]]}"`, { ...keyboard })
    states[ctx.from.id] = null;
    
    if (args[1] === 'cards') {
        const response = await queuedRequest(ctx, cardsText)
        
        user.state = {
            type: 'trainer'
        }
        
        if (!user.langs) user.langs = {}
        
        if (!user.langs['es']) {
            user.langs['es'] = {
                level: 'B1',
                words: [],
                themes: []
            }
        }
        
        
    }
    else if (args[1] === 'phrases') {
        const response = await queuedRequest(ctx, phrasesText)
    }
    
}

export async function handleTrainerState(ctx) {
    const text = ctx.text;
    
    if (!text) return ctx.reply(`Можно использовать только текст!`)
    
}

const queuedRequest = async (ctx, prompt) => {
    if(queue.length > 3 || queue.find(x => x.userId === ctx.from.id)) {
        ctx.reply(`<b>Очередь переполнена!</b>\nПопробуйте позже.`,  { parse_mode: 'HTML' })
        return null;
    }
    
    queue.push({ userId: ctx.from.id })
    
    if(queue.length) {
        const { message_id } = await ctx.reply(`<b>Ваше место в очереди: </b> ${queue.length}`,  { parse_mode: 'HTML' })
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (queue[0].userId === ctx.from.id) {
                    clearInterval(interval)
                    resolve()
                }
            }, 1000)
        })
        ctx.telegram.deleteMessage(ctx.chat.id, message_id)
    }
    
    const { message_id } = await ctx.reply(`<b>Обращаемся к тренеру...</b>`, { parse_mode: 'HTML' })
    
    let json;
    
    /* Отображаем нагрузку на процессор */
    const showCpu = () => {
        try {
            ctx.telegram.editMessageText(ctx.from.id, message_id, `<b>Обращаемся к тренеру...</b>\nУтилизация CPU: ${getCpuUsage()}%`, { parse_mode: 'HTML' })
        } catch (e) {}
    }
    
    const interval = setInterval(showCpu, 2000)
    
    for(let i = 0; i < 2; i++) {
        try {
            const response = await askOllama(prompt)
            console.log(response)
            json = JSON.parse(response)
        } catch (e) {
            await ctx.reply(`Упс! Нейросеть ответила с ошибкой (пробуем снова)\nЕё ответ: ${response}`)
        }
    }
    
    clearInterval(interval);
    
    if(!json) {
        console.error(e)
        await ctx.reply(`Не удалось сгенерировать ответ :(`,{ parse_mode: 'HTML' })
        return null;
    }
    
    queue.splice(0, 1);
    return json;
}

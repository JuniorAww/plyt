import Module from '../module.js'
import { chats } from '../utils/data.js'
import { bot } from '../index.js'

/*
// TODO
// Выбор языка, сложности (уровня) и темы
// Изначально пусть LLM генерирует 20+ тем для выбора
*/

class AITalkingModule extends Module {
    description = "Свой ии-тренер Duolingo"
    priority = 75
    
    async onMessage(ctx, next) {
        next(); return; // DISABLED (audio python module required)
        
        if (ctx.chat.id > 0) {
            const chat = await ctx.getInfo();
            
            if (ctx.text === '/words') return await handleTrainerCommand(ctx, chat)
        }
        
        next()
    }
}

const TEXT = `You are an AI language tutor. Your task is to generate a JSON object containing a list [AMOUNT] sentence for a language learner.

Follow these instructions precisely:
1. **Target Language**: [LANGUAGE]
2. **Learner's Proficiency Level**: [LEVEL]
3. **Topic**: [TOPIC]
4. **Number of Sentences**: [AMOUNT]
5.  **Output Language for Explanations**: Russian
6. **JSON Formatting**: The output must be a single, valid, compact JSON object. Do not use any extra whitespace, newlines, or indentation. It must be a single line of text.

For each sentence, provide:
-   "text": The sentence in the target language ([LANGUAGE]).
-   "translation": The accurate translation of the sentence into Russian.
-   "explanation": A concise explanation in Russian of a key grammatical concept present in the sentence, suitable for the specified proficiency level ([LEVEL]).

The entire output must be a single, valid JSON object, never escaped, starting with "[" and ending with "]". Do not include any text or formatting outside of the JSON structure.`

let generating = false;

async function getSpanishAudio(text) {
    try {
        const response = await fetch(`http://localhost:8104/tts?text=${encodeURIComponent(text)}`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.statusText}`);
        }
        
        return await response.arrayBuffer();
    } catch (error) {
        console.error('Не удалось получить аудио:', error);
        return null;
    }
}

async function sendAudio(ctx, task) {
    const user = await ctx.getUser()
    user.lang.total += 1;
    
    const audio = await getSpanishAudio(task.text);
    const caption = `🧡 <b>Текст:</b> <tg-spoiler>${task.text}</tg-spoiler>`
                  + `\n\n<b>Перевод:</b> <tg-spoiler>${task.translation}\n\n${task.explanation}</tg-spoiler>`;
    //const title = `Задание ${user.lang.total}`
    //const performer = `Плутовка` // если replyWithAudio
    
    await ctx.replyWithVoice({ source: Buffer.from(audio) }, { caption, parse_mode: 'HTML' })
}

const LEVELS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1"
]

const LANGUAGES = {
    'es': 'Spanish',
    'en': 'English',
    'fr': 'French',
    "jp": 'Japonese'
}

const handleTrainerCommand = async (ctx) => {
    const user = await ctx.getUser()
    
    /* sel - выбранный язык */
    /* sets - настройки языков */
    if (!user.lang) user.lang = {
        sel: 'es',
        sets: [
          [ 'es', 2, 'Nature' ]
        ],
        tasks: [],
        total: 0,
        points: 0
    };
    
    console.log(user.lang)
    if (!user.lang.tasks) user.lang.tasks = []
    if (user.lang.total === NaN) user.lang.total = 0
    
    if (user.lang.tasks.length) {
        const task = user.lang.tasks[0]
        user.lang.tasks.splice(0, 1);
        await sendAudio(ctx, task);
        
        return;
    }
    
    
    if (generating) return await ctx.reply("На данный момент кто-то уже генерирует слова!")
    generating = true;
    try {
        const [ language, level, topic ] = user.lang.sets.find(set => set[0] === user.lang.sel)
        
        const prompt = TEXT
                        .replace(/\[LANGUAGE\]/g, LANGUAGES[language])
                        .replace(/\[LEVEL\]/g, LEVELS[level])
                        .replace(/\[TOPIC\]/g, topic)
                        .replace(/\[AMOUNT\]/g, 2);
        
        const { message_id } = await ctx.reply("~ Начинаем урок...")
        
        const response = await getResponse(ctx, prompt)
        
        if (!response || !response[0]?.text) return await ctx.reply(`Не удалось создать задания, попробуйте снова!`)
        
        user.lang.tasks = [
            ...response.slice(1)
        ]
        
        await sendAudio(ctx, response[0]);
    } catch (e) {
        console.error(e)
    } finally {
        generating = false;
    }
}

const getResponse = async (ctx, prompt) => {
    const response = await fetch("http://ollama:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 
            JSON.stringify({
                model: "gemma2:9b",
                prompt,
                stream: true,
            }),
        signal: AbortSignal.timeout(60000)
    });
    
    let fullResponse = "";
    const decoder = new TextDecoder();

    for await (const chunk of response.body) {
        const decodedChunk = decoder.decode(chunk);
        const lines = decodedChunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            try {
                const parsedLine = JSON.parse(line);
                fullResponse += parsedLine.response || "";
                
                process.stdout.write(parsedLine.response || "");

                if (parsedLine.done) {
                    const sentences = JSON.parse(fullResponse);
                    
                    console.log("✅", sentences);
                    
                    return sentences;
                }
            } catch (e) {
                console.warn("Couldn't parse!", line);
            }
        }
    }
}

export default AITalkingModule



export const isAdmin = (ctx, chatId = null) => {
   return new Promise((resolve, reject) => {
       ctx.telegram.getChatMember(chatId ?? ctx.chat.id, ctx.from.id).then((user) => {
           resolve(user.status == "administrator" || user.status == "creator");
       })
       .catch((error) => {
            reject(error);
       });
   });
}

export const getMember = ctx => {
   return new Promise((resolve, reject) => {
       ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id).then((user) => {
           resolve(user);
       })
       .catch((error) => {
            reject(error);
       });
   });
}

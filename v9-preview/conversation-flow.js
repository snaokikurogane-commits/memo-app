// Conversation behaviour is independent of where records are stored.
export function followUpQuote(item) {
  const quote=item?.source_quote;
  if(quote && typeof quote.text==='string' && quote.text.trim())
    return {text:quote.text,occurred_at:quote.occurred_at || null};
  return {text:String(item?.body || ''),occurred_at:item?.created_at || null};
}

export function createConversationJob(input,createId=()=>crypto.randomUUID()) {
  const {personId,reply=null,editId=null,askNext=false,completeOnly=false,linksAvailable=true,hasRecap=true}=input;
  const note=String(input.note || '').trim(),recap=String(input.recap || '').trim();
  const text=!hasRecap && recap && note ? `${recap}\n${note}` : note || recap;
  const questions=(input.questions || []).map(value=>String(value).trim()).filter(Boolean);
  const now=input.now || new Date().toISOString();
  if(!personId)throw Error('人物を選んでください。');
  if(reply && reply.person_id!==personId)throw Error('別の人物の記録には紐づけられません。');
  if((askNext || reply) && !linksAvailable)throw Error('会話をつなぐ保存設定を先に更新してください。');
  if(completeOnly && (text || askNext || questions.length))throw Error('入力した記録は保存して完了してください。');
  if(completeOnly && !reply)throw Error('完了する項目がありません。');
  if(!completeOnly && !text && !questions.length)throw Error('会話メモまたは次に聞くことを入力してください。');
  if(askNext && !text)throw Error('次回聞く内容を会話メモに入力してください。');
  if(text.length>5000)throw Error('会話メモは5000文字以内にしてください。');
  if(recap.length>100)throw Error('短いまとめは100文字以内にしてください。');
  if(questions.some(value=>value.length>1000))throw Error('次に聞くことは1行1000文字以内にしてください。');
  const conversation=text ? {note:text,tags:[...(input.tags || [])],...(hasRecap?{recap:recap || null}:{}),
    ...(editId?{}:{conversation_id:createId(),person_id:personId,occurred_at:now,next_topic:'',follow_up_at:null}),
    ...(reply && !editId?{reply_to_conversation_id:reply.source_conversation_id || null,
      reply_to_follow_up_id:reply.follow_up_id,reply_quote:followUpQuote(reply)}:{})} : null;
  const rows=questions.map(body=>({follow_up_id:createId(),person_id:personId,body,due_at:input.due || null}));
  if(askNext && conversation && !editId)rows.push({follow_up_id:createId(),person_id:personId,
    body:Array.from(text).slice(0,1000).join(''),due_at:input.due || null,
    source_conversation_id:conversation.conversation_id,source_quote:{text,occurred_at:now}});
  return {id:createId(),personId,editId,conversation,questions:rows,completeId:reply?.follow_up_id || null,
    completedAt:now,conversationConfirmed:false,questionsConfirmed:false,completeConfirmed:false};
}

export async function saveConversationJob(job,store,{isActive=()=>true,onProgress=()=>{}}={}) {
  const active=()=>{if(!isActive())throw Error('ログイン状態が変わりました。現在のアカウントで内容を確認してください。');};
  active();
  if(job.conversation && !job.conversationConfirmed) {
    job.savedConversation=await store.saveConversation(job.conversation,job.editId,job.personId);
    job.conversationConfirmed=true;onProgress();
  }
  active();
  if(job.questions.length && !job.questionsConfirmed) {
    job.savedQuestions=await store.saveQuestions(job.questions,job.personId);
    job.questionsConfirmed=true;onProgress();
  }
  active();
  if(job.completeId && !job.completeConfirmed) {
    await store.completeQuestion(job.completeId,job.personId,job.completedAt);
    job.completeConfirmed=true;onProgress();
  }
  active();
  return {conversation:job.savedConversation || null,questions:job.savedQuestions || [],completedId:job.completeId || null};
}

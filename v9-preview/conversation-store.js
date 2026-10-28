// Storage boundary: the UI and flow do not depend on Supabase queries.
export class SupabaseConversationStore {
  constructor(client){this.client=client;}
  verify(row,expected) {
    if(!row || Object.entries(expected).some(([key,value])=>JSON.stringify(row[key] ?? null)!==JSON.stringify(value ?? null)))
      throw Error('保存結果を確認できませんでした。内容を保持したまま再試行できます。');
    return row;
  }
  async saveConversation(row,editId=null,personId=row.person_id) {
    const table=this.client.from('conversations');
    const result=editId
      ? await table.update(row).eq('conversation_id',editId).eq('person_id',personId)
      : await table.upsert(row,{onConflict:'conversation_id',ignoreDuplicates:true});
    if(result.error)throw result.error;
    const saved=await this.client.from('conversations').select('*').eq('person_id',personId)
      .eq('conversation_id',editId || row.conversation_id).single();
    if(saved.error)throw saved.error;
    return this.verify(saved.data,{...row,person_id:personId});
  }
  async saveQuestions(rows,personId) {
    const result=await this.client.from('follow_up_items').upsert(rows,{onConflict:'follow_up_id',ignoreDuplicates:true});
    if(result.error)throw result.error;
    const saved=await this.client.from('follow_up_items').select('*').eq('person_id',personId)
      .in('follow_up_id',rows.map(row=>row.follow_up_id));
    if(saved.error)throw saved.error;
    return rows.map(row=>this.verify(saved.data?.find(item=>item.follow_up_id===row.follow_up_id),row));
  }
  async completeQuestion(id,personId,completedAt) {
    const result=await this.client.from('follow_up_items').update({status:'completed',completed_at:completedAt})
      .eq('follow_up_id',id).eq('person_id',personId).eq('status','open');
    if(result.error)throw result.error;
    const saved=await this.client.from('follow_up_items').select('*').eq('follow_up_id',id).eq('person_id',personId).single();
    if(saved.error)throw saved.error;
    return this.verify(saved.data,{follow_up_id:id,person_id:personId,status:'completed'});
  }
}

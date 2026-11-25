import type { CompanionData } from '../../domain/models'
import { browserObjective,requestsAttachment,type BrowserTaskGoal } from './taskGoal'

type Pending={objective:BrowserTaskGoal['objective'];goal:string;origin?:string;signature:string;expires:number}
const pending=new Map<string,Pending>()
const timers=new Map<string,ReturnType<typeof setTimeout>>()
const signature=(companion:CompanionData)=>JSON.stringify([companion.browser,companion.provider,companion.permissions.fullAccess,companion.permissions.internet])
/** Only local task slots. No page/result text, credentials or tab IDs. */
export function prepareBrowserTurn(message:string,companion:CompanionData,channel='main'){
  const previous=pending.get(channel),current=signature(companion)
  const currentObjective=previous?browserObjective(message,companion.name):undefined
  forgetBrowserTurn(channel)
  const attachmentDetail=previous&&requestsAttachment(previous.goal)&&/^(?:课程(?:是|叫|[:：])|资料(?:是|叫|[:：])|就选|我说的是|去找的是)/u.test(message.trim())
  const followup=attachmentDetail||/^(?:继续|再查(?:一下)?|重试|就是|也就是|这个|那个|用这个|查这个|https?:\/\/)/u.test(message.trim())
  if(!previous||previous.expires<=Date.now()||previous.signature!==current||!followup||currentObjective&&!attachmentDetail&&!/^(?:就是|也就是|这个|那个|用这个|查这个|继续|重试)/u.test(message.trim()))return {message,resolvedFromClarification:false}
  const cue=currentObjective&&!attachmentDetail&&!requestsAttachment(previous.goal)&&!/^(?:就是|也就是|用这个|查这个|https?:\/\/)/u.test(message.trim())?message:previous.goal
  const explicit=/https?:\/\//u.test(message)
  const effective=`${cue}，${message}${!explicit&&previous.origin?` ${previous.origin}`:''}`
  return {message:effective,resolvedFromClarification:explicit}
}
export function rememberBrowserTurn(task:BrowserTaskGoal|undefined,companion:CompanionData,channel='main',goal=''){
  if(!task||/密码|password|Bearer\s|token\s*[:=]/iu.test(goal))return
  if(pending.size>=4&&!pending.has(channel))pending.delete(pending.keys().next().value!)
  // Replace the old URL on clarification; mail and mails are not aliases.
  const safeGoal=goal.replace(/https?:\/\/[^\s，。；;]+/gu,'').trim().slice(0,800)||'读取我的授权网站页面'
  forgetBrowserTurn(channel)
  pending.set(channel,{objective:task.objective,goal:safeGoal,origin:task.origins.length===1?task.origins[0]:undefined,signature:signature(companion),expires:Date.now()+300000})
  timers.set(channel,setTimeout(()=>forgetBrowserTurn(channel),300000))
}
export function forgetBrowserTurn(channel='main'){pending.delete(channel);clearTimeout(timers.get(channel));timers.delete(channel)}

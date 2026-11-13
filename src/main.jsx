import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Activity, BarChart3, Camera, Download, Dumbbell, FileUp, HardDriveDownload, Home, Moon, Plus, RefreshCcw, Save, ScanBarcode, Settings, Trash2, Utensils, X, CheckCircle2, AlertTriangle} from 'lucide-react'
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar} from 'recharts'
import {BrowserMultiFormatReader} from '@zxing/browser'
import {registerSW} from 'virtual:pwa-register'
import {getAll, getDraft, saveDraft, clearDraft, getSetting, setSetting, put, putMany, remove, mergeImport, maybeSnapshot, listSnapshots, readSnapshot, requestPersistentStorage} from './db'
import {lookupBarcode, shrinkPhoto} from './food'
import './style.css'
import './extra.css'

const currentDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
const uid = () => crypto.randomUUID()
const timestamp = () => new Date().toISOString()
const colors=['#66a6ff','#46d6a1','#c28cff','#ffb454','#ff718d','#5bd6dc','#edbd65']
const routines={
  Pull: ['Bent-over Rows','Dumbbell Pullovers','Rear Delt Flys','Incline Curls','Hammer Curls','Russian Twists'],
  Push: ['Bench Press','Incline Dumbbell Press','Dumbbell Flys','Seated Dumbbell Shoulder Press','Lateral Raises','Triceps Extensions'],
  Legs: ['Goblet Squats','Sumo Squats','Dumbbell Romanian Deadlifts','Glute Bridges','Calf Raises','Weighted Crunches']
}
const emptyFood=()=>({name:'',calories:'',protein:'',carbs:'',fat:'',sodium:'',fiber:'',serving:'',amount:'1',barcode:'',source:'Manual entry',notes:'',photo:''})
const emptyDaily=()=>({weight:'',energy:'5',recovery:'5',stress:'5',water:'',notes:''})
const emptySleep=()=>({bed:'22:45',wake:'07:30',quality:'7',notes:''})
const emptyActivity=()=>({type:'Cycling',duration:'',calories:'',notes:''})
const emptyWorkout=()=>({routine:'Pull',exercise:'Bent-over Rows',sets:[{id:uid(),weight:'',reps:''}],notes:''})
const toNum=(x)=>x==='' || x==null ? null : Number(x)
const goodNumber=(x)=>x==='' || x==null || (Number.isFinite(Number(x))&&Number(x)>=0)
const fmt=(x)=>Number.isFinite(x)?Number(x.toFixed(1)).toLocaleString():'—'
const byNewest=(a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||''))
const group=(records,type)=>records.filter(r=>r.type===type)
const progressMax=(workout)=>Math.max(0,...(workout.sets||[]).map(s=>Number(s.weight)||0))
const progressVolume=(workout)=>(workout.sets||[]).reduce((sum,s)=>sum+(Number(s.weight)||0)*(Number(s.reps)||0),0)
const hoursOf=(bed,wake)=>{
  if(!bed||!wake)return null
  const [h1,m1]=bed.split(':').map(Number),[h2,m2]=wake.split(':').map(Number)
  let mins=h2*60+m2-h1*60-m1
  if(mins<0) mins+=1440
  return Math.round(mins/6)/10
}
function useDraft(key, initial) {
  const [value,setValue]=useState(()=>{
    try {const saved=localStorage.getItem(`form-draft:${key}`);return saved?JSON.parse(saved):initial}
    catch{return initial}
  })
  const changed=useRef(false)
  const update=(next)=>{
    setValue(old=>{
      const v=typeof next==='function'?next(old):next
      changed.current=true
      try {localStorage.setItem(`form-draft:${key}`,JSON.stringify(v))}catch{}
      return v
    })
  }
  useEffect(()=>{
    // IndexedDB fallback when localStorage is disabled or has been cleared.
    let active=true
    getDraft(key).then(saved=>{
      let inLocal=false
      try{inLocal=Boolean(localStorage.getItem(`form-draft:${key}`))}catch{}
      if(active && !changed.current && saved && !inLocal) setValue(saved)
    }).catch(()=>{})
    return ()=>{active=false}
  },[key])
  useEffect(()=>{const timer=setTimeout(()=>saveDraft(key,value).catch(()=>{}),400);return ()=>clearTimeout(timer)},[key,value])
  const reset=(next=initial)=>{
    try{localStorage.removeItem(`form-draft:${key}`)}catch{}
    changed.current=false
    setValue(next)
    clearDraft(key).catch(()=>{})
  }
  return [value,update,reset]
}
// These components must stay OUTSIDE App to preserve input identity/focus.
function Panel({title,sub,children}) {return <section className="panel"><div className="section-title"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div></div>{children}</section>}
function Field({label,children}) {return <label className="field"><span>{label}</span>{children}</label>}
function Input(props) {return <input {...props}/>}
function Empty({children}) {return <div className="empty"><span>{children}</span></div>}
function Record({title,detail,onRemove,onEdit,image}) {return <div className="record">{image&&<img className="thumb" src={image} alt="Food"/>}<div><b>{title}</b><small>{detail}</small></div>{onEdit&&<button className="tiny-btn" aria-label={`Edit ${title}`} title="Edit" onClick={onEdit}>Edit</button>}<button className="tiny-btn" aria-label={`Delete ${title}`} title="Delete" onClick={()=>{if(window.confirm(`Delete ${title}?`))onRemove()}}><Trash2 size={16}/></button></div>}
function BarcodeScanner({onCode,onClose}) {
  const video=useRef(null)
  const callback=useRef(onCode)
  const [error,setError]=useState('Starting camera…')
  useEffect(()=>{callback.current=onCode},[onCode])
  useEffect(()=>{
    let mounted=true,ctrl=null,found=false
    const reader=new BrowserMultiFormatReader()
    reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video.current,(result)=>{
      if(result && mounted && !found){found=true;const code=result.getText();ctrl?.stop();callback.current(code)}
    }).then(controls=>{ctrl=controls;if(mounted)setError('Point the camera at a product barcode.');else controls.stop()})
      .catch(e=>{if(mounted)setError(`Camera unavailable: ${e.message}. Enter the barcode manually below.`)})
    return ()=>{mounted=false;ctrl?.stop()}
  },[])
  return <div className="scanner"><video ref={video} playsInline muted autoPlay aria-label="Barcode scanning camera"/><p>{error}</p><button type="button" className="secondary" onClick={onClose}><X size={16}/> Close camera</button></div>
}
function saveDownload(filename, content, mime='application/json') {
  const blob=new Blob([content],{type:mime})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url;link.download=filename
  document.body.appendChild(link);link.click();link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),10000)
}
function App(){
  const [records,setRecords]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('Home')
  const [date,setDate]=useDraft('active-date',currentDate())
  const [message,setMessage]=useState('')
  const [saveBusy,setSaveBusy]=useState(false)
  const [persistent,setPersistent]=useState(null)
  const [backupList,setBackupList]=useState([])
  const [lastExport,setLastExport]=useState(0)
  const [updateApp,setUpdateApp]=useState(null)
  const [food,setFood,resetFood]=useDraft('food',emptyFood())
  const [workout,setWorkout,resetWorkout]=useDraft('workout',emptyWorkout())
  const [daily,setDaily,resetDaily]=useDraft('daily',emptyDaily())
  const [sleep,setSleep,resetSleep]=useDraft('sleep',emptySleep())
  const [activity,setActivity,resetActivity]=useDraft('activity',emptyActivity())
  const [customName,setCustomName]=useState('')
  const [editing,setEditing]=useState(null)
  const [barcode,setBarcode]=useState('')
  const [scanner,setScanner]=useState(false)
  const [lookupBusy,setLookupBusy]=useState(false)
  const [foodFound,setFoodFound]=useState('')
  const [progressRoutine,setProgressRoutine]=useState('All')
  const [selectedExercises,setSelectedExercises]=useState(['Bench Press'])
  const [metric,setMetric]=useState('max')
  const [period,setPeriod]=useState('90')
  const [exportStart,setExportStart]=useState('')
  const [exportEnd,setExportEnd]=useState('')
  const [importBusy,setImportBusy]=useState(false)
  const [restoring,setRestoring]=useState(false)

  const alert=(text)=>setMessage(text)
  const refresh=async()=>setRecords(await getAll())
  const refreshBackups=async()=>setBackupList(await listSnapshots())

  useEffect(()=>{
    let active=true
    Promise.all([getAll(),getSetting('last-export'),listSnapshots()])
      .then(([r,last,snaps])=>{if(active){setRecords(r);setLastExport(last||0);setBackupList(snaps)}})
      .catch(e=>{if(active)alert(`Storage error: ${e.message}. Do not clear site data.`)})
      .finally(()=>{if(active)setLoading(false)})
    navigator.storage?.persisted?.().then(v=>{if(active)setPersistent(v)}).catch(()=>{})
    return ()=>{active=false}
  },[])
  useEffect(()=>{
    const updateSW=registerSW({onNeedRefresh(){setUpdateApp(()=>updateSW)},onOfflineReady(){/* available offline */}})
  },[])
  useEffect(()=>{
    const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('form-fitness-updates')
    if(channel)channel.onmessage=()=>refresh().catch(()=>{})
    return ()=>channel?.close()
  },[])
  const announceChange=()=>{if(typeof BroadcastChannel!=='undefined'){const c=new BroadcastChannel('form-fitness-updates');c.postMessage('changed');c.close()}}
  const afterWrite=async()=>{
    await refresh()
    announceChange()
    maybeSnapshot().then(refreshBackups).catch(()=>{})
  }
  const persist=async(record, after)=>{
    if(saveBusy)return false
    setSaveBusy(true)
    try{
      await put({...record,createdAt:record.createdAt||timestamp(),updatedAt:timestamp()})
      await afterWrite()
      after?.()
      alert('Saved on this device. Safe to close the browser.')
      return true
    }catch(e){alert(`Save failed: ${e.message}. Your form was not cleared.`);return false}
    finally{setSaveBusy(false)}
  }
  const persistMany=async(items,after)=>{
    if(saveBusy)return false
    setSaveBusy(true)
    try{
      const now=timestamp()
      await putMany(items.map(r=>({...r,createdAt:r.createdAt||now,updatedAt:now})))
      await afterWrite()
      after?.()
      alert('Saved on this device. Safe to close the browser.')
      return true
    }catch(e){alert(`Save failed: ${e.message}. Your form was not cleared.`);return false}
    finally{setSaveBusy(false)}
  }
  const del=async(id)=>{
    try {await remove(id);await afterWrite();alert('Deleted. Previous local snapshots may allow recovery.')}
    catch(e){alert(`Delete failed: ${e.message}`)}
  }

  const workouts=group(records,'workout').sort(byNewest)
  const meals=group(records,'meal').sort(byNewest)
  const weighins=group(records,'weighin').sort(byNewest)
  const sleeps=group(records,'sleep').sort(byNewest)
  const activities=group(records,'activity').sort(byNewest)
  const dailies=group(records,'daily').sort(byNewest)
  const customExercises=group(records,'customExercise')
  const exerciseOptions=useMemo(()=>[...new Set([
    ...(routines[workout.routine]||[]),
    ...customExercises.filter(r=>r.routine===workout.routine).map(r=>r.exercise),
    ...workouts.filter(w=>w.routine===workout.routine).map(w=>w.exercise)
  ])], [workout.routine,customExercises,workouts])
  const allExercises=useMemo(()=>[...new Set([...Object.values(routines).flat(),...customExercises.map(c=>c.exercise),...workouts.map(w=>w.exercise)])].sort(),[customExercises,workouts])
  const selectedDateMeals=meals.filter(m=>m.date===date)
  const totals=selectedDateMeals.reduce((a,m)=>{
    for(const key of ['calories','protein','carbs','fat','sodium','fiber'])a[key]+=Number(m[key])||0
    return a
  },{calories:0,protein:0,carbs:0,fat:0,sodium:0,fiber:0})
  const selectedDayWeight=weighins.find(w=>w.date===date)
  const selectedDayDaily=dailies.find(w=>w.date===date)
  const latestSnapshot=backupList[0]
  const nav=[['Home',Home],['Workouts',Dumbbell],['Progress',BarChart3],['Nutrition',Utensils],['Recovery',Moon],['Data',Settings]]

  const addCustomExercise=async()=>{
    const name=customName.trim()
    if(!name)return alert('Enter an exercise name.')
    const ok=await persist({id:uid(),type:'customExercise',exercise:name,routine:workout.routine})
    if(ok){setWorkout(w=>({...w,exercise:name}));setCustomName('')}
  }
  const saveWorkout=async()=>{
    const valid=workout.sets.filter(s=>s.weight!==''&&s.reps!=='')
    if(!valid.length || valid.some(s=>!goodNumber(s.weight)||!goodNumber(s.reps)||Number(s.reps)<=0))return alert('Enter nonnegative weights and reps greater than zero for at least one set.')
    const payload={id:editing?.type==='workout'?editing.id:uid(),type:'workout',date,routine:workout.routine,exercise:workout.exercise,sets:valid.map(s=>({weight:Number(s.weight),reps:Number(s.reps)})),notes:workout.notes,createdAt:editing?.createdAt}
    await persist(payload,()=>{setEditing(null);resetWorkout({...workout,sets:[{id:uid(),weight:valid.at(-1)?.weight||'',reps:''}],notes:''})})
  }
  const editWorkout=w=>{
    setDate(w.date);setEditing({id:w.id,type:'workout',createdAt:w.createdAt});setWorkout({routine:w.routine,exercise:w.exercise,sets:(w.sets||[]).map(s=>({...s,id:uid(),weight:String(s.weight),reps:String(s.reps)})),notes:w.notes||''})
    setTab('Workouts');window.scrollTo({top:0,behavior:'smooth'})
  }
  const saveDaily=async()=>{
    if(daily.weight!=='' && (!goodNumber(daily.weight)||Number(daily.weight)<=0))return alert('Enter a valid morning weight or leave it blank.')
    const key=`daily:${date}`,weightKey=`weighin:${date}`
    const saved=records.find(r=>r.id===key)
    const base={id:key,type:'daily',date,...daily,weight:toNum(daily.weight),water:toNum(daily.water),energy:Number(daily.energy),recovery:Number(daily.recovery),stress:Number(daily.stress),createdAt:saved?.createdAt}
    const pair=[base]
    if(daily.weight!=='')pair.push({id:weightKey,type:'weighin',date,weight:Number(daily.weight),createdAt:records.find(r=>r.id===weightKey)?.createdAt})
    await persistMany(pair,()=>resetDaily(emptyDaily()))
  }
  const saveSleep=async()=>{
    const duration=hoursOf(sleep.bed,sleep.wake)
    if(duration==null || duration===0)return alert('Enter valid bed and wake times.')
    const payload={id:editing?.type==='sleep'?editing.id:uid(),type:'sleep',date,bed:sleep.bed,wake:sleep.wake,duration,quality:Number(sleep.quality),notes:sleep.notes,createdAt:editing?.createdAt}
    await persist(payload,()=>{setEditing(null);resetSleep(emptySleep())})
  }
  const saveActivity=async()=>{
    if(!activity.type.trim()||!goodNumber(activity.duration)||!activity.duration||Number(activity.duration)<=0||!goodNumber(activity.calories))return alert('Enter an activity and a positive duration. Calories are optional.')
    const payload={id:editing?.type==='activity'?editing.id:uid(),type:'activity',date,...activity,duration:Number(activity.duration),calories:toNum(activity.calories),createdAt:editing?.createdAt}
    await persist(payload,()=>{setEditing(null);resetActivity(emptyActivity())})
  }
  const saveFood=async()=>{
    if(!food.name.trim())return alert('Enter the food or meal name.')
    if(!goodNumber(food.amount)||!food.amount||Number(food.amount)<=0)return alert('Enter a positive number of servings.')
    if(['calories','protein','carbs','fat','sodium','fiber'].some(k=>!goodNumber(food[k])))return alert('Nutrition values must be nonnegative.')
    const amount=Number(food.amount)
    const payload={id:editing?.type==='meal'?editing.id:uid(),type:'meal',date,name:food.name.trim(),
      ...Object.fromEntries(['calories','protein','carbs','fat','sodium','fiber'].map(k=>[k,food[k]===''?null:Number((Number(food[k])*amount).toFixed(2))])),
      amount,serving:food.serving,barcode:food.barcode,source:food.source,notes:food.notes,photo:food.photo,createdAt:editing?.createdAt}
    await persist(payload,()=>{setEditing(null);resetFood(emptyFood());setFoodFound('');setBarcode('')})
  }
  const editFood=m=>{
    setDate(m.date);setEditing({id:m.id,type:'meal',createdAt:m.createdAt})
    // Meal records store total nutrients, so show one serving when editing.
    setFood({...emptyFood(),...m,amount:'1',...Object.fromEntries(['calories','protein','carbs','fat','sodium','fiber'].map(k=>[k,m[k]==null?'':String(m[k])]))})
    setTab('Nutrition');window.scrollTo({top:0,behavior:'smooth'})
  }
  const lookup=async(code=barcode)=>{
    setLookupBusy(true);setScanner(false);setFoodFound('')
    try{
      const found=await lookupBarcode(code)
      setFood(old=>({...old,...found,photo:old.photo,notes:old.notes}))
      setBarcode(found.barcode)
      setFoodFound(`Found in Open Food Facts. Nutrition is per ${found.serving}. Check the package before saving; some values may be missing.`)
    }catch(e){alert(e.message)}
    finally{setLookupBusy(false)}
  }
  const handlePhoto=async(e)=>{
    const file=e.target.files?.[0];if(!file)return
    try{const photo=await shrinkPhoto(file);setFood(f=>({...f,photo}));alert('Photo attached to the unsaved meal. Press Save meal to keep it.')}
    catch(err){alert(`Photo error: ${err.message}`)}
    e.target.value=''
  }
  const useMeal=m=>{
    setEditing(null)
    setFood({...emptyFood(),...m,id:undefined,createdAt:undefined,amount:'1',...Object.fromEntries(['calories','protein','carbs','fat','sodium','fiber'].map(k=>[k,m[k]==null?'':String(m[k])]))})
    setTab('Nutrition');window.scrollTo({top:0,behavior:'smooth'})
  }

  const graphWorkouts=workouts.filter(w=>(progressRoutine==='All'||w.routine===progressRoutine)&&(period==='all'||Date.now()-new Date(`${w.date}T12:00:00`).getTime()<Number(period)*86400000))
  const visibleExerciseList=allExercises.filter(x=>progressRoutine==='All'||routines[progressRoutine]?.includes(x)||workouts.some(w=>w.routine===progressRoutine&&w.exercise===x)||customExercises.some(w=>w.routine===progressRoutine&&w.exercise===x))
  const plotted=selectedExercises.filter(x=>visibleExerciseList.includes(x))
  const chartRows=[...new Set(graphWorkouts.filter(w=>plotted.includes(w.exercise)).map(w=>w.date))].sort().map(day=>{
    const row={date:day,label:day.slice(5)}
    for(const exercise of plotted){
      const entries=graphWorkouts.filter(w=>w.date===day&&w.exercise===exercise)
      if(entries.length){row[exercise]=metric==='volume'?Math.round(entries.reduce((s,w)=>s+progressVolume(w),0)*10)/10:Math.max(...entries.map(progressMax))}
    }
    return row
  })
  const weightRows=[...weighins].sort((a,b)=>a.date.localeCompare(b.date)).map(w=>({date:w.date,label:w.date.slice(5),weight:w.weight}))
  const daySummary=[...new Set([...dailies,...sleeps,...workouts,...meals,...activities].map(r=>r.date).filter(Boolean))].sort().reverse().slice(0,14).map(day=>({
    date:day,
    energy:dailies.find(x=>x.date===day)?.energy,
    sleep:sleeps.find(x=>x.date===day)?.duration,
    protein:meals.filter(x=>x.date===day).reduce((s,x)=>s+(Number(x.protein)||0),0),
    workouts:workouts.filter(x=>x.date===day).length,
    activity:activities.filter(x=>x.date===day).reduce((s,x)=>s+(Number(x.duration)||0),0)
  }))
  const exportRecords=records.filter(r=>r.type==='customExercise'||(!exportStart||!r.date||r.date>=exportStart)&&(!exportEnd||!r.date||r.date<=exportEnd))
  const exportJSON=async()=>{
    const payload={app:'FORM Fitness Tracker',schemaVersion:2,exportedAt:timestamp(),dateRange:{from:exportStart||null,to:exportEnd||null},records:exportRecords}
    saveDownload(`FORM-backup-${currentDate()}.json`,JSON.stringify(payload,null,2))
    await setSetting('last-export',Date.now());setLastExport(Date.now());alert(`Exported ${exportRecords.length} records to a JSON file.`)
  }
  const exportCSV=()=>{
    const heads=['date','type','exercise_or_name','routine','sets','max_weight_lb','volume_lb_reps','calories','protein_g','carbs_g','fat_g','sodium_mg','fiber_g','duration_hours','duration_minutes','quality','weight_lb','energy','notes']
    const get=r=>[r.date,r.type,r.exercise||r.name||r.type,r.routine||'',r.type==='workout'?r.sets?.map(s=>`${s.weight}lb x ${s.reps}`).join('; '):'',r.type==='workout'?progressMax(r):'',r.type==='workout'?progressVolume(r):'',r.calories,r.protein,r.carbs,r.fat,r.sodium,r.fiber,r.type==='sleep'?r.duration:'',r.type==='activity'?r.duration:'',r.quality,r.weight,r.energy,r.notes]
    const escapeCell=v=>`"${String(v??'').replaceAll('"','""')}"`
    saveDownload(`FORM-data-${currentDate()}.csv`,[heads,...exportRecords.filter(r=>r.date).map(get)].map(row=>row.map(escapeCell).join(',')).join('\r\n'),'text/csv')
  }
  const importJSON=async(event)=>{
    const file=event.target.files?.[0]
    if(!file)return
    setImportBusy(true)
    try{
      if(file.size>40*1024*1024)throw Error('File exceeds 40 MB; use a smaller backup.')
      const value=JSON.parse(await file.text())
      if(!Array.isArray(value.records)||!['FORM Fitness Tracker','Form Fitness Tracker'].includes(value.app))throw Error('This is not a recognized FORM backup.')
      if(!window.confirm(`Import ${value.records.length} records? Existing records with the same ID will be updated; other records are kept.`))return
      await mergeImport(value.records)
      await afterWrite()
      alert(`Imported ${value.records.length} records successfully.`)
    }catch(e){alert(`Import failed: ${e.message}`)}
    finally{event.target.value='';setImportBusy(false)}
  }
  const restoreSnapshot=async(snapshot)=>{
    if(!window.confirm(`Merge ${snapshot.count} records from the snapshot taken ${new Date(snapshot.at).toLocaleString()}? Records with the same IDs will be replaced. Export a JSON backup first.`))return
    setRestoring(true)
    try{const found=await readSnapshot(snapshot.id);if(!found)throw Error('Snapshot not found');await mergeImport(found.records);await afterWrite();alert('Snapshot records restored.')}
    catch(e){alert(`Restore failed: ${e.message}`)}
    finally{setRestoring(false)}
  }
  const enablePersistence=async()=>{
    try{const value=await requestPersistentStorage();setPersistent(value);alert(value?'Browser granted persistent storage.':'Browser did not grant persistent storage. JSON exports are still recommended.')}
    catch(e){alert(`Could not request storage: ${e.message}`)}
  }
  const dateField=<Field label="Entry date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>

  if(loading)return <main className="loading">Loading saved FORM records…</main>
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">F</div><div><strong>FORM</strong><small>PERSONAL FITNESS TRACKER</small></div></div><div className="top-actions"><span className="save-state">{saveBusy?'Saving…':'Saved locally'}</span><button className="icon-btn" title="Open backup tools" aria-label="Open backup tools" onClick={()=>setTab('Data')}><HardDriveDownload size={19}/></button></div></header>
    {message&&<div className="notice" role="status"><span>{message}</span><button aria-label="Dismiss notice" onClick={()=>setMessage('')}><X size={15}/></button></div>}
    {updateApp&&<div className="notice"><span>An app update is ready. Save your work first.</span><button className="secondary" onClick={()=>updateApp(true)}>Update app</button></div>}
    <main className="content">
    {tab==='Home'&&<>
      <div className="welcome"><div><p className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p><h1>Your training,<br/><span>all in one place.</span></h1></div><div className="welcome-icon"><Activity size={30}/></div></div>
      <div className="stats-grid"><div className="stat"><span>Workouts logged</span><b>{workouts.length}</b></div><div className="stat"><span>Meals logged</span><b>{meals.length}</b></div><div className="stat"><span>Sleep logs</span><b>{sleeps.length}</b></div><div className="stat"><span>Activities</span><b>{activities.length}</b></div></div>
      <Panel title="Daily check-in" sub="Track energy, recovery, water and your optional morning weigh-in. Entries for a date update that date instead of piling up duplicates.">
        {dateField}
        <div className="form-grid"><Field label="Morning weight (lb)"><Input type="number" min="0" inputMode="decimal" placeholder="Optional" value={daily.weight} onChange={e=>setDaily({...daily,weight:e.target.value})}/></Field><Field label="Water (oz)"><Input type="number" min="0" inputMode="numeric" placeholder="Optional" value={daily.water} onChange={e=>setDaily({...daily,water:e.target.value})}/></Field></div>
        {['energy','recovery','stress'].map(key=><Field key={key} label={`${key.charAt(0).toUpperCase()+key.slice(1)} · ${daily[key]}/10`}><Input type="range" min="1" max="10" value={daily[key]} onChange={e=>setDaily({...daily,[key]:e.target.value})}/></Field>)}
        <Field label="Notes"><textarea value={daily.notes} placeholder="Optional: How did your day feel?" onChange={e=>setDaily({...daily,notes:e.target.value})}/></Field>
        <button disabled={saveBusy} className="primary" onClick={saveDaily}><Save size={16}/> Save check-in</button>
      </Panel>
      <Panel title="Selected day's overview"><div className="overview-row"><span>Meals</span><b>{selectedDateMeals.length}</b></div><div className="overview-row"><span>Energy logged</span><b>{fmt(totals.calories)} kcal</b></div><div className="overview-row"><span>Protein logged</span><b>{fmt(totals.protein)} g</b></div><div className="overview-row"><span>Morning weight</span><b>{selectedDayWeight?`${fmt(Number(selectedDayWeight.weight))} lb`:'Not logged'}</b></div><div className="overview-row"><span>Workout sessions</span><b>{workouts.filter(w=>w.date===date).length}</b></div><div className="overview-row"><span>Energy check-in</span><b>{selectedDayDaily?`${selectedDayDaily.energy}/10`:'Not logged'}</b></div></Panel>
      <Panel title="Your data protection"><p className="helper">Your saved records stay on this browser after restarts. Unfinished text is also saved as a draft. This does not synchronize data between devices.</p><div className="overview-row"><span>Local snapshots</span><b>{backupList.length}</b></div><div className="overview-row"><span>Last exported JSON</span><b>{lastExport?new Date(lastExport).toLocaleDateString():'Not yet'}</b></div><div className="button-row"><button className="secondary" onClick={exportJSON}><Download size={16}/> Download backup</button><button className="secondary" onClick={()=>setTab('Data')}>Data settings</button></div></Panel>
    </>}
    {tab==='Workouts'&&<>
      <div className="page-heading"><p className="eyebrow">TRAINING LOG</p><h1>Workouts</h1><p>Save each exercise with its sets, reps and weights.</p></div>
      <Panel title={editing?.type==='workout'?'Edit logged exercise':'Log an exercise'} sub="Draft entries survive a browser restart, even before pressing Save.">
        {dateField}
        <div className="segmented">{Object.keys(routines).map(r=><button key={r} className={workout.routine===r?'active':''} onClick={()=>setWorkout(w=>({...w,routine:r,exercise:routines[r][0]}))}>{r}</button>)}</div>
        <Field label="Exercise"><select value={exerciseOptions.includes(workout.exercise)?workout.exercise:exerciseOptions[0]} onChange={e=>setWorkout({...workout,exercise:e.target.value})}>{exerciseOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
        <div className="inline-add"><Input placeholder="New custom exercise" value={customName} onChange={e=>setCustomName(e.target.value)}/><button className="secondary" onClick={addCustomExercise}><Plus size={16}/> Add</button></div>
        <div className="set-header"><span>SET</span><span>WEIGHT (LB)</span><span>REPS</span><span></span></div>
        {workout.sets.map((s,i)=><div key={s.id} className="set-row"><b>{i+1}</b><Input type="number" min="0" inputMode="decimal" placeholder="Weight" value={s.weight} onChange={e=>setWorkout(w=>({...w,sets:w.sets.map(x=>x.id===s.id?{...x,weight:e.target.value}:x)}))}/><Input type="number" min="1" inputMode="numeric" placeholder="Reps" value={s.reps} onChange={e=>setWorkout(w=>({...w,sets:w.sets.map(x=>x.id===s.id?{...x,reps:e.target.value}:x)}))}/><button className="tiny-btn" aria-label="Remove set" onClick={()=>setWorkout(w=>({...w,sets:w.sets.length>1?w.sets.filter(x=>x.id!==s.id):w.sets}))}><X size={16}/></button></div>)}
        <Field label="Notes (optional)"><textarea value={workout.notes} placeholder="Form, energy, or adjustments" onChange={e=>setWorkout({...workout,notes:e.target.value})}/></Field>
        <div className="button-row"><button className="secondary" onClick={()=>setWorkout(w=>({...w,sets:[...w.sets,{id:uid(),weight:w.sets.at(-1)?.weight||'',reps:''}]}))}><Plus size={16}/> Add set</button><button disabled={saveBusy} className="primary" onClick={saveWorkout}><Save size={16}/> {editing?.type==='workout'?'Update exercise':'Save exercise'}</button></div>
        {editing?.type==='workout'&&<button className="text-button" onClick={()=>{setEditing(null);resetWorkout(emptyWorkout())}}>Cancel editing</button>}
      </Panel>
      <Panel title="Recent workouts"><div className="record-list">{workouts.length?workouts.slice(0,30).map(w=><Record key={w.id} title={w.exercise} detail={`${w.date} · ${w.routine} · ${(w.sets||[]).map(s=>`${s.weight} lb × ${s.reps}`).join(', ')}`} onRemove={()=>del(w.id)} onEdit={()=>editWorkout(w)}/>):<Empty>Nothing logged yet. Save your first exercise above.</Empty>}</div></Panel>
    </>}
    {tab==='Progress'&&<>
      <div className="page-heading"><p className="eyebrow">CHARTS & PATTERNS</p><h1>Progress</h1><p>Compare logged exercise weights and training volume.</p></div>
      <Panel title="Exercise progression" sub="Choose multiple exercises. Weight uses your highest logged load that day; volume adds weight × reps across all saved sets that day.">
        <div className="form-grid"><Field label="Workout group"><select value={progressRoutine} onChange={e=>setProgressRoutine(e.target.value)}><option>All</option>{Object.keys(routines).map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Time range"><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">1 year</option><option value="all">All history</option></select></Field></div>
        <Field label="Chart metric"><select value={metric} onChange={e=>setMetric(e.target.value)}><option value="max">Highest weight (lb)</option><option value="volume">Total volume (lb × reps)</option></select></Field>
        <div className="exercise-chips">{visibleExerciseList.map((x,i)=><button key={x} className={selectedExercises.includes(x)?'chosen':''} style={{'--chip':colors[i%colors.length]}} onClick={()=>setSelectedExercises(old=>old.includes(x)?old.filter(y=>y!==x):[...old,x])}>{x}</button>)}</div>
        {chartRows.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height={290}><LineChart data={chartRows} margin={{top:8,right:15,bottom:0,left:0}}><CartesianGrid stroke="#333743" strokeDasharray="3 3"/><XAxis dataKey="label" stroke="#9a9eaa"/><YAxis stroke="#9a9eaa" width={48}/><Tooltip contentStyle={{background:'#191b23',border:'1px solid #343743',color:'#fff'}}/><Legend/>{plotted.map((name,i)=><Line key={name} type="monotone" dataKey={name} stroke={colors[i%colors.length]} strokeWidth={2.5} dot={{r:4}} connectNulls={false}/>)}</LineChart></ResponsiveContainer></div>:<Empty>Choose an exercise and log workouts to see points on the graph.</Empty>}
      </Panel>
      <Panel title="Morning weight history" sub="A record of measurements, not a target.">{weightRows.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><LineChart data={weightRows}><CartesianGrid stroke="#333743" strokeDasharray="3 3"/><XAxis dataKey="label" stroke="#9a9eaa"/><YAxis stroke="#9a9eaa" width={48} domain={['auto','auto']}/><Tooltip contentStyle={{background:'#191b23',border:'1px solid #343743'}}/><Line name="Morning weight (lb)" type="monotone" dataKey="weight" stroke="#46d6a1" dot/></LineChart></ResponsiveContainer></div>:<Empty>Save morning weigh-ins to start this history.</Empty>}</Panel>
      <Panel title="Recent daily context" sub="Compare sleep, activity, food logged and workout frequency. Missing values mean not logged; these are not proof of causation.">
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Sleep</th><th>Energy</th><th>Protein logged</th><th>Workout logs</th><th>Activity</th></tr></thead><tbody>{daySummary.map(row=><tr key={row.date}><td>{row.date}</td><td>{row.sleep==null?'—':`${fmt(row.sleep)} h`}</td><td>{row.energy==null?'—':`${row.energy}/10`}</td><td>{fmt(row.protein)} g</td><td>{row.workouts}</td><td>{row.activity} min</td></tr>)}</tbody></table></div>
      </Panel>
    </>}
    {tab==='Nutrition'&&<>
      <div className="page-heading"><p className="eyebrow">FOOD JOURNAL</p><h1>Nutrition</h1><p>Manual meal entry or barcode-assisted nutrition lookup.</p></div>
      <Panel title="Logged for selected date"><div className="nutrition-grid">{[['Energy',totals.calories,'kcal'],['Protein',totals.protein,'g'],['Carbs',totals.carbs,'g'],['Fat',totals.fat,'g'],['Sodium',totals.sodium,'mg'],['Fiber',totals.fiber,'g']].map(([label,value,unit])=><div key={label} className="nutrition-stat"><span>{label}</span><b>{fmt(value)}</b><small>{unit}</small></div>)}</div><p className="helper">Totals only reflect meals you entered, not everything you necessarily ate.</p></Panel>
      <Panel title="Find a packaged food by barcode" sub="Use your camera on a barcode, or enter its digits. Open Food Facts data is community-maintained and may be incomplete.">
        <div className="inline-add"><Input inputMode="numeric" aria-label="Product barcode" placeholder="Barcode number" value={barcode} onChange={e=>setBarcode(e.target.value)}/><button className="secondary" disabled={lookupBusy} onClick={()=>lookup()}>{lookupBusy?'Searching…':'Look up'}</button></div>
        <button className="secondary scan-button" onClick={()=>setScanner(v=>!v)}><ScanBarcode size={18}/>{scanner?'Close camera':'Scan barcode with camera'}</button>
        {scanner&&<BarcodeScanner onCode={code=>lookup(code)} onClose={()=>setScanner(false)}/>}<p className="helper">Camera scanning needs permission and HTTPS (GitHub Pages provides HTTPS). You can always type the barcode manually.</p>
        {foodFound&&<p className="found" role="status"><CheckCircle2 size={16}/>{foodFound}</p>}
      </Panel>
      <Panel title={editing?.type==='meal'?'Edit meal':'Add a food or meal'} sub="Review values from the product label. You can also attach a photo of the Nutrition Facts panel for reference; photos are not OCR-read.">
        {dateField}
        <Field label="Food or meal name"><Input value={food.name} placeholder="e.g. yogurt and fruit" onChange={e=>setFood({...food,name:e.target.value})}/></Field>
        <div className="form-grid"><Field label="Serving description"><Input value={food.serving} placeholder="e.g. 1 cup / 100 g" onChange={e=>setFood({...food,serving:e.target.value})}/></Field><Field label="Number of servings"><Input type="number" min="0.01" step="any" inputMode="decimal" value={food.amount} onChange={e=>setFood({...food,amount:e.target.value})}/></Field></div>
        <div className="form-grid">{[['Energy (kcal)','calories'],['Protein (g)','protein'],['Carbs (g)','carbs'],['Fat (g)','fat'],['Sodium (mg)','sodium'],['Fiber (g)','fiber']].map(([label,key])=><Field key={key} label={`${label} per serving`}><Input type="number" min="0" step="any" inputMode="decimal" placeholder="Not entered" value={food[key]} onChange={e=>setFood({...food,[key]:e.target.value,source:'Manual / reviewed'})}/></Field>)}</div>
        <label className="upload-box"><Camera size={22}/><span>{food.photo?'Replace saved label/meal photo':'Attach Nutrition Facts or meal photo'}</span><small>Photo stays in your browser backup</small><input type="file" accept="image/*" onChange={handlePhoto}/></label>
        {food.photo&&<div className="photo-row"><img className="meal-photo" src={food.photo} alt="Attached meal or label"/><button className="tiny-btn" onClick={()=>setFood({...food,photo:''})}>Remove photo</button></div>}
        <Field label="Notes (optional)"><textarea value={food.notes} onChange={e=>setFood({...food,notes:e.target.value})}/></Field>
        <button className="primary" disabled={saveBusy} onClick={saveFood}><Save size={16}/>{editing?.type==='meal'?'Update meal':'Save meal'}</button>
        {editing?.type==='meal'&&<button className="text-button" onClick={()=>{setEditing(null);resetFood(emptyFood())}}>Cancel editing</button>}
      </Panel>
      <Panel title="Recent foods"><div className="record-list">{meals.length?meals.slice(0,30).map(m=><div className="food-record" key={m.id}><Record title={m.name} image={m.photo} detail={`${m.date} · ${m.calories??'—'} kcal · ${m.protein??'—'} g protein · ${m.serving||'Serving not specified'}`} onEdit={()=>editFood(m)} onRemove={()=>del(m.id)}/><button className="text-button" onClick={()=>useMeal(m)}>Use again for a new meal</button></div>):<Empty>No meals recorded yet.</Empty>}</div></Panel>
    </>}
    {tab==='Recovery'&&<>
      <div className="page-heading"><p className="eyebrow">SLEEP & MOVEMENT</p><h1>Recovery</h1><p>Record sleep and daily activities, including biking.</p></div>
      <Panel title="Sleep log" sub="Select the morning you woke up. Overnight sleep is calculated automatically.">
        {dateField}<div className="form-grid"><Field label="Went to bed"><Input type="time" value={sleep.bed} onChange={e=>setSleep({...sleep,bed:e.target.value})}/></Field><Field label="Woke up"><Input type="time" value={sleep.wake} onChange={e=>setSleep({...sleep,wake:e.target.value})}/></Field></div>
        <div className="overview-row"><span>Calculated duration</span><b>{hoursOf(sleep.bed,sleep.wake)??'—'} hours</b></div>
        <Field label={`Sleep quality · ${sleep.quality}/10`}><Input type="range" min="1" max="10" value={sleep.quality} onChange={e=>setSleep({...sleep,quality:e.target.value})}/></Field>
        <Field label="Sleep notes"><textarea value={sleep.notes} onChange={e=>setSleep({...sleep,notes:e.target.value})}/></Field>
        <button className="primary" disabled={saveBusy} onClick={saveSleep}><Moon size={16}/> Save sleep</button>
        <div className="record-list">{sleeps.slice(0,15).map(s=><Record key={s.id} title={`${fmt(Number(s.duration))} hours`} detail={`${s.date} · ${s.bed}–${s.wake} · quality ${s.quality}/10`} onRemove={()=>del(s.id)}/>)}</div>
      </Panel>
      <Panel title="Activity log">
        {dateField}<Field label="Activity"><select value={activity.type} onChange={e=>setActivity({...activity,type:e.target.value})}><option>Cycling</option><option>Walking</option><option>School activity</option><option>Sports</option><option>Other</option></select></Field>
        <div className="form-grid"><Field label="Duration (minutes)"><Input type="number" min="0" inputMode="numeric" value={activity.duration} onChange={e=>setActivity({...activity,duration:e.target.value})}/></Field><Field label="Estimated calories burned (optional)"><Input type="number" min="0" inputMode="numeric" value={activity.calories} onChange={e=>setActivity({...activity,calories:e.target.value})}/></Field></div>
        <Field label="Notes"><textarea value={activity.notes} onChange={e=>setActivity({...activity,notes:e.target.value})}/></Field>
        <button className="primary" disabled={saveBusy} onClick={saveActivity}><Activity size={16}/> Save activity</button>
        <div className="record-list">{activities.slice(0,15).map(a=><Record key={a.id} title={a.type} detail={`${a.date} · ${a.duration} min · ${a.calories==null?'No calorie estimate':`${a.calories} kcal (estimate)`}`} onRemove={()=>del(a.id)}/>)}</div>
      </Panel>
    </>}
    {tab==='Data'&&<>
      <div className="page-heading"><p className="eyebrow">LOCAL DATA</p><h1>Backups & settings</h1><p>Protect your history and move it between devices if needed.</p></div>
      <Panel title="Where your data lives" sub="Saved in this browser using IndexedDB. This works after restarts and offline, but it is not a cloud account.">
        <p className="helper">Your computer and phone will each have separate data. To move records, export JSON on one device and import it on the other. Browser-site-data deletion, private browsing, lost devices and some storage-cleanup tools can erase local records.</p>
        <div className="overview-row"><span>Stored records</span><b>{records.length}</b></div><div className="overview-row"><span>Browser persistent storage</span><b>{persistent===true?'Granted':persistent===false?'Not granted':'Unknown'}</b></div>
        <button className="secondary" onClick={enablePersistence}>Request stronger storage protection</button>
      </Panel>
      <Panel title="Download a separate backup" sub="JSON exports include your entries and attached photos; use them to restore, transfer data or provide ChatGPT with a chosen date range.">
        <div className="form-grid"><Field label="From date (optional)"><Input type="date" value={exportStart} onChange={e=>setExportStart(e.target.value)}/></Field><Field label="Through date (optional)"><Input type="date" value={exportEnd} onChange={e=>setExportEnd(e.target.value)}/></Field></div>
        <p className="helper">Selected for export: {exportRecords.length} records. Leave both dates blank for a full backup. Custom exercise definitions are always included.</p>
        <div className="button-row"><button className="primary" onClick={exportJSON}><Download size={17}/> Export JSON</button><button className="secondary" onClick={exportCSV}><Download size={17}/> Export CSV</button></div>
        <p className="helper">Last JSON export: {lastExport?new Date(lastExport).toLocaleString():'Never'}. Download a new backup periodically and before changing devices.</p>
      </Panel>
      <Panel title="Import an existing backup" sub="Imports merge records by ID without wiping other records. An import can replace a matching record, so export first.">
        <label className="upload-box"><FileUp size={23}/><span>{importBusy?'Importing…':'Select an exported FORM JSON file'}</span><input type="file" accept="application/json,.json" disabled={importBusy} onChange={importJSON}/></label>
      </Panel>
      <Panel title="Automatic local snapshots" sub="A snapshot is created after your first save and approximately daily when you use the app, retaining up to 14 versions. Snapshots do NOT protect against loss of all browser data.">
        <button className="secondary" onClick={async()=>{try{await maybeSnapshot(true);await refreshBackups();alert('Local snapshot created.')}catch(e){alert(`Snapshot failed: ${e.message}`)}}}><HardDriveDownload size={16}/> Snapshot now</button>
        <div className="record-list">{backupList.length?backupList.slice(0,14).map(b=><div key={b.id} className="record"><div><b>{new Date(b.at).toLocaleString()}</b><small>{b.count} records</small></div><button className="secondary" disabled={restoring} onClick={()=>restoreSnapshot(b)}>Restore</button></div>):<Empty>No snapshots yet. Save a record or click Snapshot now.</Empty>}</div>
      </Panel>
    </>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([name,Icon])=><button key={name} className={tab===name?'active':''} onClick={()=>{setTab(name);setEditing(null);window.scrollTo({top:0,behavior:'instant'})}} aria-current={tab===name?'page':undefined}><Icon size={19}/><span>{name}</span></button>)}</nav>
    <footer className="foot">FORM · LOCAL-FIRST JOURNAL · EXPORT BACKUPS FOR LONG-TERM SAFETY</footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)

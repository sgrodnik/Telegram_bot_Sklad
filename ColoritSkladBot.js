// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const startTime = new Date()
let prevTime = new Date()
const base = 'https://api.telegram.org/bot' + token + '/'
const ssIdSpisanieColorit = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ssIdColSdelkaDetWorks = '1BusvTFU8zoEIg727bk6IxBe88S-B2WfFxLHux7xc4BY'
const ssIdSdelka = '1jf-3SuKyVneiQNWv7616OOrZLP7UGK8qrvhw2AGQSqI'
const props = PropertiesService.getScriptProperties()

let update
let user
let cachedTables
const cachedSss = {}
let printToSGCounter = 0
let printToSGValues= []
const sections = {writeOff: 1,
                  addition: 2,
                  registration: 3}


const DEBUG = 0

function doPost(e){
  try{
    update = JSON.parse(e.postData.contents)
    log('updateLog', e.postData.contents)
    createOrFetchUser()
    processUpdate()
  }
  catch(err){
    // const text = `${err}\n\nUser: ${JSON.stringify(user, null, 4)}`
    const text = `Ошибка ${err}`
    printToSG(`Ошибка, подробности в логе (${user.name})\n${err}`)
    const now = new Date();
    const scriptDuration = now - startTime
    // printToSG(`_Error timings_\nscriptDuration: ${scriptDuration}\n${getTimings()}`)
    const logUser = {
      name: user.name,
      id: user.id,
      prevVisit: user.prevVisit,
      lastVisit: user.lastVisit,
      debug: user.debug,
      rights: user.rights,
      writeOff: user.writeOff,
      addition: user.addition,
      reg: user.reg,
      message: user.message,
      inline_query: user.inline_query,
      callback_query: user.callback_query,
    }
    log('errorLog', `${err}\nUser:\n${JSON.stringify(logUser)}`)
    // tableAppend(now(), 'Ошибка', text)
  }
}

function log(logName, text) {
  const MAX_LOG_LENGTH = 60
  const updateLog = JSON.parse(props.getProperty(logName)) || []
  updateLog.push(`${new Date()}: ${text}`)
  if (updateLog.length > MAX_LOG_LENGTH) updateLog.shift()
  props.setProperty(logName, JSON.stringify(updateLog))
}

function printLog(logName) {
  const str = props.getProperty(logName);
  const updateLog = JSON.parse(str) || []
  for (const item of updateLog) {
    console.log(item)
  }
  console.log(`${logName} size is ${getSizeInKb(str)}, it contains ${updateLog.length} items`)
}


function clearLog(logName) {
  props.setProperty(logName, JSON.stringify([]))
  console.log(`${logName} is cleared`)
}

function printUpdateLog(){ printLog('updateLog') }
function printErrorLog(){ printLog('errorLog') }
function printTimingLog(){ printLog('timingLog') }
function printScriptLog(){ printLog('scriptLog') }

function clearErrorLog(){ clearLog('errorLog') }

function getTimings(unbornUser=null) {
  let s = `Total: ${(unbornUser || user).debug.functionsTotal}\n(start)`
  const total = (unbornUser || user).debug.functions.map(o=>o.dur).reduce((partialSum, a) => partialSum + a, 0)
  for (const fun of (unbornUser || user).debug.functions) {
    const percentage = fun.dur / total * 100;
    s += `${Math.round(percentage)}% ${fun.dur} ms\n${fun.name}flag\n`
  }
  return s.replaceAll('flag\n', ' ')
}

function createOrFetchUser() {
  const paramName = update.message ? 'message'
                  : update.inline_query ? 'inline_query'
                  : update.callback_query ? 'callback_query'
                  : null
  if (!paramName) throw `Unexpected incoming paramName received: ${paramName}, id ${update[paramName] ? update[paramName].from ? update[paramName].from.id : '?' : '??'}`
  const param = update[paramName]
  user = JSON.parse(props.getProperty(`User ${param.from.id}`)) || {
    writeOff: Object(),
    addition: Object(),
    reg: Object(),
    messages: [],
    visits: 1
  }
  user.visits > 0 ? user.visits++ : user.visits = 1
  user.id = param.from.id
  user.name = param.from.first_name || param.from.username || param.from.last_name
  user.message = update.message
  user.inline_query = update.inline_query
  user.callback_query = update.callback_query
  user.prevVisit=JSON.parse(JSON.stringify(user.lastVisit))
  user.lastVisit = new Date()
  const dur = new Date() - prevTime
  prevTime = new Date()
  log('timingLog', `${user.prevVisit}\n${user.name}\n${getTimings(user)}`)
  user.debug = {functions: [{dur, name: arguments.callee.name}]}
  user.rights = getRigths()
}

function getRigths() {
  addCurrentFuncToTrace()
  const table = getTableUserRights()
  const titles = table[2]
  const writeOff = {any: false}
  const addition = {any: false}
  const registration = {any: false}
  for (const row of table) {
    if (user.id !== row[0]) continue
    for (let i = 2; i < 11; i++) {
      const flag = row[i]
      writeOff[titles[i]] = flag
      if (flag) writeOff.any = true
    }
    for (let i = 14; i < 15; i++) {
      const flag = row[i]
      addition[titles[i]] = flag
      if (flag) addition.any = true
    }
    for (let i = 15; i < 18; i++) {
      const flag = row[i]
      registration[titles[i]] = flag
      if (flag) registration.any = true
    }
  }
  return {writeOff, addition, registration}
}

function addCurrentFuncToTrace() {
  const dur = new Date() - prevTime
  prevTime = new Date()
  const name = arguments.callee.caller.name;
  // user.debug.functions.push(`+${duration}ms: ${name}`)
  user.debug.functions.push({dur, name})
  user.debug.functionsTotal = new Date() - startTime
  saveUser()
}

function processUpdate(){
  addCurrentFuncToTrace()
  if(user.inline_query){
    user.debug.sentData = {type: 'inline_query', data: user.inline_query.query}
    processInlineQuery()
  }
  if(user.callback_query){
    user.debug.sentData = {type: 'callback_query', data: user.callback_query.data}
    if(user.callback_query.data.startsWith('Списать'))      writeOff()
    if(user.callback_query.data.startsWith('Меню'))         switchMenu()
    if(user.callback_query.data.startsWith('ТройноеМеню'))  updateTrioMenu()
    if(user.callback_query.data.startsWith('Добавить'))     makeAddition()
    if(user.callback_query.data.startsWith('Registration')) processRegistration()
  }
  if(user.message && user.message.text){
    user.debug.sentData = {type: 'message', data: user.message.text}
    if(user.message.text.startsWith('/section'))          setSection()
    else if(user.message.text.startsWith('/s'))           greetUser()
    else if(user.message.text.startsWith('Выбрать'))      selectMat()
    else if(user.message.text.startsWith('Заказ'))        selectNum()
    else if(user.message.text.startsWith('Registration')) processRegistration()
    else if(isFloat(user.message.text))                   confirmAmount()
    else if(user.message)                                 incorrectInput()
  }
  user.debug.scriptStart = startTime
  user.debug.scriptEnd = new Date()
  user.debug.scriptDur = new Date() - startTime
  user.debug.functions = []
  const logUser = {name: user.name, id: user.id, debug: user.debug}
  log('scriptLog',JSON.stringify(logUser))
  // todo оповестить о непонятке и удалить
}

function processInlineQuery(){
  addCurrentFuncToTrace()
  const query = user.inline_query.query
  let results
  if (!query || query.length < 1) results = []
  else if (user.menuSection === 'RegistrationMenu')
    results = getRegistrationInlineResults(query)
  else if (query.startsWith('#') && user.menuSection === 'AddMenu')
    results = getOrderNumberAdditionInlineResults(query)
  else if (query === '#') results = getOrderNumberInlineResults(query)
  else if (query.startsWith('+') && query.length > 1) results = getNewPaintNameInlineResults(query)
  else results = getNameInlineResults(query)
  answerInlineQuery(user.inline_query.id, results.slice(0, 50))
}

function getRegistrationInlineResults(query) {
  addCurrentFuncToTrace()
  const results = []
  let counter = 0
  const catalog = getCachedTables().catalogOrders

  if (query.startsWith('ShowOrderNums')) {
    query = query.replace('ShowOrderNums', '').trim()
    for (const order in catalog) {
      if (isQueryAndIsNotIncludedIn(query, order)) continue
      counter++
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `Заказ № ${order}`,
        input_message_content: {
          message_text: 'Registration Set orderNum ' + order
        }
      })
    }
  }

  function isQueryAndIsNotIncludedIn(query, entity){
    const isNotQueryIncluded =
      !entity.toLowerCase().includes(query.toLowerCase());
    return query && isNotQueryIncluded
  }

  if (query.startsWith('ShowWorks')) {
    query = query.replace('ShowWorks', '').trim()
    const uniqueWorks = []
    for (const orderNum in catalog) {
      if (orderNum !== user.reg.orderNum) continue
      const details = catalog[orderNum]
      for (const detailNum in details) {
        const works = details[detailNum]
        for (const workId in works) {
            const work = getCachedTables().catalogWorks[workId]
          if (isQueryAndIsNotIncludedIn(query, work.workStr)) continue
          if (uniqueWorks.includes(workId)) continue
          uniqueWorks.push(workId)
          counter++
          results.push({
            id: counter.toString(),
            type: 'article',
            title: `${work.work}`,
            description: `${work.workType}, Заказ ${orderNum}`,
            // description: `${counter}), id${workId}, ${work.workType}, Заказ ${orderNum}`,
            input_message_content:
              {message_text: 'Registration Set workId ' + workId}
          })
        }
      }
    }
  }

  if (query.startsWith('ShowDetailNums')) {
    query = query.replace('ShowDetailNums', '').trim()
    for (const orderNum in catalog) {
      if (user.reg.orderNum !== orderNum) continue
      const details = catalog[orderNum]
      for (const detailNum in details) {
        const works = details[detailNum]
        for (const workId in works) {
          const quantity = works[workId]
          if (quantity <= 0) continue
          if (user.reg.workId !== workId) continue
          if (isQueryAndIsNotIncludedIn(query, detailNum)) continue
          counter++
          results.push({
            id: counter.toString(),
            type: 'article',
            title: `Деталь ${detailNum}: ${quantity} шт.`,
            input_message_content: {
              message_text: 'Registration SetDetailNum _ ' + detailNum
            }
          })
        }
      }
    }
  }

  const notEmptyResults = fillIfEmpty(results, query)
  return notEmptyResults
}

function getTablesRegistration(what) {
  addCurrentFuncToTrace()
  if (what === 'details'){
    const details = []
    for (const row of getCachedTables().details) {
      if (!row[0]) continue
      const orNum = row[0]
      const detNum = row[1]
      const size = row[2]
      const quantity = row[3]
      if (orNum && quantity) details.push({
        orNum: orNum,
        detNum: detNum,
        size: size,
        quantity: quantity,
      })
    }
    return details
  }
  const works = []
  for (const row of getCachedTables().works) {
    if (!row[0]) continue
    works.push({id: row[0], type: row[1], work: row[3]})
  }
  return works
}

function getOrderNumberAdditionInlineResults(query) {
  addCurrentFuncToTrace()
  query = query.replace('#', '')
  let results = []
  let counter = 0
  const table = getTableSettings()
  for (const num of table.nums) {
    if (!num.includes(query)) continue
    counter++
    results.push({
      id: counter.toString(),
      type: 'article',
      title: `${num}`,
      input_message_content: {
        message_text: 'Заказ ' + num
      }
    })
  }
  results = fillIfEmpty(results, query)
  return results
}

function getTableSettings() {
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('НАСТРОЙКИ')
  const range = sheet.getRange(2, 1, 1000, 4)
  const result = {nums: []}
  for (const row of range.getValues()) {
    const num = row[1]
    if (num) result.nums.push(num.toString())
  }
  return result
}

function getSs(ssId) {
  addCurrentFuncToTrace()
  if (ssId in cachedSss) return cachedSss[ssId]
  cachedSss[ssId] = SpreadsheetApp.openById(ssId)
  return cachedSss[ssId]
}

function fillIfEmpty(results, query) {
  addCurrentFuncToTrace()
  if (results.length === 0) {
    results.push({
      id: 1,
      type: 'article',
      title: `🤔По запросу "${query}" ничего не найдено 👀`,
      input_message_content: {
        message_text: `-`
      }
    })
  }
  return results
}

function getOrderNumberInlineResults(query) {
  addCurrentFuncToTrace()
  const orderNumbers = {}
  for (const row of getTableStorage()) {
    const num = row[5];
    if (num === '') {continue}
    if (!(num in orderNumbers)) {
      orderNumbers[num] = 0
    }
    orderNumbers[num]++
  }

  let results = []
  let counter = 0
  for (const num in orderNumbers) {
    counter++
    results.push({
      id: counter.toString(),
      type: 'article',
      title: `#${num} | ${orderNumbers[num]} шт.`,
      input_message_content: {
        message_text: 'Заказ ' + num
      }
    })
  }
  results = fillIfEmpty(results, query)
  return results
}

function getTableStorage() {
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('СКЛАД')
  const range = sheet.getRange(4, 1, 500, 13)
  const result = []
  let allowedGroups = getAllowedGroups(user.id)
  for (const row of range.getValues()) {
    const subgroup = row[2]
    const residue = Number(row[11])
    if (allowedGroups.includes(subgroup) && residue > 0) result.push(row)
  }
  return result
}

function getAllowedGroups(userId) {
  addCurrentFuncToTrace()
  const tableUser = getTableUser()
  const allMats = tableUser[0].slice(2, -1)
  for (const row_ of tableUser){
    if (userId === row_[0]){
      const allowedMats = []
      const allMatsStatuses = row_.slice(2, -1)
      for (const i of [...Array(allMatsStatuses.length).keys()]) {
        if (allMatsStatuses[i] === true) allowedMats.push(allMats[i])
      }
      return allowedMats
    }
  }
  return allMats
}

function getTableUser() {
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('ПОЛЬЗОВАТЕЛИ')
  const range = sheet.getRange(3, 1, 50, 32)
  return range.getValues()
}

function getTableUserRights() {
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('ПОЛЬЗОВАТЕЛИ')
  const range = sheet.getDataRange()
  return range.getValues()
}

function getNewPaintNameInlineResults(query) {
  addCurrentFuncToTrace()
  let results = []
  let counter = 0
  for (const row of getTableNewPaint()) {
    const name = row[4]
    const clearedName = clear(name)
    if (clearedName.toLowerCase().includes(query.toLowerCase().replace('+', ''))) {
      counter++
      const messageText = 'Выбрать ' + name
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `${name}`,
        input_message_content: {message_text: messageText},
        thumb_url: row[5],
        thumb_width: 5,
        thumb_height: 5
      })
    }
  }
  results = fillIfEmpty(results, query)
  return results;
}

function getTableNewPaint() {
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('КРАСКА')
  const range = sheet.getRange(43, 1, 5000, 6)
  const result = range.getValues()
  return result
}

function clear(s) {
  return String(s).replaceAll('\n', ' ').replaceAll('"', '')
}

function getNameInlineResults(query) {
  addCurrentFuncToTrace()
  let results = []
  let counter = 0
  for (const row of getTableStorage()) {
    const id = row[0]
    const name = clear(row[3])
    const supplyer = row[4]
    const num = row[5]
    const stellaj = row[6]
    const polka = row[7]
    const place = stellaj + polka
    const condition = query.startsWith('#') ?
        '#' + num === query :
        name.toLowerCase().includes(query.toLowerCase())
    if (condition) {
      counter++
      const residue = String(Math.round(row[11] * 100) / 100).replaceAll('.', ',')
      const noZak = num === '-' || num === '' ? '' : ` | #${num}`
      const messageText = 'Выбрать ' + humanize(name, place, residue, id)
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `${name} | ${supplyer}${noZak}`,
        description: `Остаток ${residue} кг | Расположение: ${stellaj} ${polka}`,
        input_message_content: {message_text: messageText},
        thumb_url: row[12],
        thumb_width: Number(10),
        thumb_height: Number(10)
      })
    }
  }
  results = fillIfEmpty(results, query)
  return results;
}

function humanize(name, place, residue, id) {
  addCurrentFuncToTrace()
  let s = JSON.stringify([name, 'Место ' + place, residue + ' кг', 'id' + id])
  s = s.replace('["', ': ')
  s = s.replace('"]', '')
  s = s.replaceAll('","', ' | ')
  return s
}

function answerInlineQuery(inline_query_id, results){
  addCurrentFuncToTrace()
  let data = {
    method: 'post',
    payload: {
      method: 'answerInlineQuery',
      inline_query_id: String(inline_query_id),
      results: JSON.stringify(results),
      cache_time: Number(10)
    }
  }
  UrlFetchApp.fetch(base, data)
}

function writeOff() {
  addCurrentFuncToTrace()
  const callbackQuery = user.callback_query
  const amount = callbackQuery.data.replace('Списать ', '')
  const [matName, matId] = user.writeOff.matNameAndMatId
  const message = callbackQuery.message
  const date = toDate(message.date)
  tableAppend(date, user.id, matId, amount)
  let residue = 0
  for (const row of getTableStorage()) {
    if(String(row[0]) === matId){
      residue = row[11] || 0
    }
  }
  props.setProperty(matId, residue)
  residue = String(Math.round(residue * 100) / 100).replaceAll('.', ',')
  const demo = isUserAuthorized() ? '' : ' <tg-spoiler>, Демо-режим</tg-spoiler>'
  const text = `👌 списано <b>${amount}</b> кг <b>${matName}</b>, Остаток ${residue} кг${demo}`
  const keyboard = {inline_keyboard: createButtonsWriteOffMenu()}
  let [chatId, messageId] = editMessage(message.chat.id, message.message_id, text, keyboard)
  deleteMessages(message.chat.id, user.id)
  editPrevReport(chatId)
  storeReportToEditNextTime(chatId, messageId, text)
  storeMenuMessage(messageId, text, keyboard)
}

function toDate(unixTimestamp){
  addCurrentFuncToTrace()
  const milliseconds = unixTimestamp * 1000
  const dateObject = new Date(milliseconds)
  return now(dateObject)
}

function isUserAuthorized() {
  addCurrentFuncToTrace()
  for (const row_ of getTableUser()){
    if (user.id === row_[0]){
      return true
    }
  }
  return false
}

function editMessage(chatId, messageId, text, keyboard=null){
  addCurrentFuncToTrace()
  let data = {
    method: 'post',
    payload: {
      method: 'editMessageText',
      chat_id: String(chatId),
      message_id: Number(messageId),
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard ? JSON.stringify(keyboard) : ''
    },
    // muteHttpExceptions: true
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId_ = JSON.parse(response.getContentText()).result.message_id
  // printToSG('result:\n' + JSON.stringify(result, null, 4))
  return [chatId_, messageId_]
}

function deleteMessages() {
  addCurrentFuncToTrace()
  for (const message of user.messages) {
    deleteMessage(user.id, message.id)
  }
  user.messages.length = 0
  saveUser()
}

function deleteMessage(chatId, messageId){
  addCurrentFuncToTrace()
  let data = {
    method: 'post',
    payload: {
      method: 'deleteMessage',
      chat_id: String(chatId),
      message_id: Number(messageId)
    },
    // muteHttpExceptions: true
  }
  try {
    UrlFetchApp.fetch(base, data)
  } catch (err) {
    const text = `${err}\n\nUser: ${JSON.stringify(user, null, 4)}}`
    printToSG(text)
  }
}

function editPrevReport(chatId) {
  addCurrentFuncToTrace()
  let [messageId, text] = user.reportMessage
  user.reportMessage = null
  saveUser()
  editMessage(chatId, messageId, text)
}

function storeReportToEditNextTime(fromId, messageId, text) {
  addCurrentFuncToTrace()
  user.reportMessage = {id: messageId, text: text}
  saveUser()
}

function storeMenuMessage(messageId, text, keyboard) {
  addCurrentFuncToTrace()
  user.menuMessage = {id: messageId, text: text, keyboard: keyboard}
  saveUser()
}

function switchMenu(act=null) {
  addCurrentFuncToTrace()
  let text = null
  const action = act || user.callback_query.data.replace('Меню ', '')
  switch (action.split(' ')[0]) {
    case 'Списание':
      if (user.rights.writeOff.any) user.menuSection = 'WriteOffMenu'
      break
    case 'Добавление':
      if (user.rights.addition.any) user.menuSection = 'AddMenu'
      break
    case 'Регистрация':
      if (user.rights.registration.any) {
        user.menuSection = 'RegistrationMenu'
        cacheRegistrationTables()
        showRegistrationMenu()
      }
      return
    case 'Показать':
      user.writeOff.selectedGroup = action.replace('Показать ', ''); break
    case 'Назад':
      user.writeOff.selectedGroup = null; break
    case 'НазадГлавное':
      user.menuSection = null
      text = `Привет, ${user.name}! Выбери секцию:`
      break
  }
  saveUser()
  const keyboard = {inline_keyboard: createButtons()}
  editMenuMessage(text, keyboard)
}

function saveUser() {
  props.setProperty(`User ${user.id}`, JSON.stringify(user))
}

function cacheRegistrationTables() {
  addCurrentFuncToTrace()
  const ss = getSs(ssIdColSdelkaDetWorks)
  const sheet = ss.getSheetByName('Матрица детали/работы')
  const redundantColNumber = 1
  const numColumns = sheet.getMaxColumns() - redundantColNumber;
  const rangeDetails = sheet.getRange(1, 1, sheet.getMaxRows(), numColumns)
  const catalogOrders = {}
  const catalogWorks = {}
  const rangeValues = rangeDetails.getValues()
  const works = rangeValues.slice(0, 3)
  for (const row of rangeValues.slice(4)) {
    const orderNum = row[0]
    const detailNum = row[1]
    if (!orderNum) continue
    for (let i = 4; i < numColumns; i++) { // todo проверить последний столбец
      const quantity = row[i]
      if (quantity <= 0) continue
      const workStr = `${i}::${works[0][i]}::${works[2][i]}`
      const workId = `${i}`
      catalogWorks[i] = {workType: works[0][i], work: works[2][i], workStr: workStr}
      if (!(orderNum in catalogOrders)) catalogOrders[orderNum] = {}
      if (!(detailNum in catalogOrders[orderNum]))
        catalogOrders[orderNum][detailNum] = {}
      catalogOrders[orderNum][detailNum][workId] = quantity
    }
  }
  cachedTables = {
    catalogOrders: catalogOrders,
    catalogWorks: catalogWorks
  }
  saveCachedTables(cachedTables)
}

function getCachedTables() {
  cachedTables = cachedTables || JSON.parse(props.getProperty('cachedTables'))
  return cachedTables
}

function saveCachedTables(obj) {
  addCurrentFuncToTrace()
  const s = JSON.stringify(obj);
  // printToSG('cache size: ' + getSizeInKb(s))
  props.setProperty('cachedTables', s)
}

function getSizeInKb(string) {
  let size = (encodeURI(string).split(/%..|./).length - 1) / 1024;
  size = Math.round(size * 10) / 10
  return size + ' Kb';
}

function showRegistrationMenu(freshly=null) {
  addCurrentFuncToTrace()
  if (user.reg.workId){
    const theWork = getCachedTables().catalogWorks[user.reg.workId]
    user.reg.workType = theWork ? theWork.workType : null
    user.reg.work = theWork ? theWork.work : null
  }
  if (user.reg.allDetailsAtOnce === 'true'){
    const allDetails = getCachedTables().catalogOrders[user.reg.orderNum]
    const resDetails = []
    let sum = 0
    for (const detailNum in allDetails) {
      const works = allDetails[detailNum]
      for (const workId in works) {
        const quantity = works[workId]
      // printToSGOncePerValue('workId ' + workId)
        if (quantity > 0 && workId === user.reg.workId){
          resDetails.push({detailNum, quantity})
          sum += quantity
        }
      }
    }
    user.reg.allDetailsAtOnce = resDetails
    user.reg.detailNum = `${resDetails.map(o=>o.detailNum).join(', ')}`
    user.reg.quantity = `${resDetails.map(o=>o.quantity).join('+')} = ${sum}`
    saveUser()
  }

  const text = `Для отчёта о работе заполни форму:
№ заказа: ${user.reg.orderNum || '-'}
Вид работ: ${user.reg.workType || '-'}
Работа: ${user.reg.work || '-'}
№ детали: ${user.reg.detailNum || '-'}
Количество деталей: ${user.reg.quantity || '-'}`
  const keyboard = {inline_keyboard: createButtonsRegistrationMenu()}
  if (user.menuMessage) editMenuMessage(text, keyboard)
  else {
    let [_, messageId] = sendMessageToUser(text, keyboard)
    storeMenuMessage(messageId, text, keyboard)
  }
}

function createButtonsRegistrationMenu() {
  addCurrentFuncToTrace()
  let maxCall = 'pass'
  let maxText = ' '
  let minCall = 'pass'
  let minText = ' '
  let manualText = ' '
  let confirmCall = 'pass'
  let confirmText = '(Поля не заполнены)'
  let quantity
  if (user.reg.detailNum && !user.reg.allDetailsAtOnce){
    const order = getCachedTables().catalogOrders[user.reg.orderNum];
    if (user.reg.detailNum in order) {
      quantity = order[user.reg.detailNum][user.reg.workId]
      if (quantity > 1) {
        maxCall = `Registration Set quantity ${quantity}`
        maxText = `Все ${quantity} шт.`
        minCall = `Registration Set quantity ${1}`
        minText = '1 шт.'
        manualText = '(либо введи)'
      }
      if (quantity === 1) {
        minCall = `Registration Set quantity ${1}`
        minText = 'Всего 1 шт.'
      }
    }
  }
  if (
    user.reg.workId &&
    user.reg.orderNum &&
    user.reg.detailNum &&
    user.reg.quantity
  ) {
    confirmCall = 'Registration Apply'
    confirmText = 'Готово ✓'
  }

  const btnOrderNum = {text: 'Выбрать № заказа'}
  if (user.reg.orderNum) btnOrderNum.text = `Выбран заказ ${user.reg.orderNum}`

  const btnWork = {text: 'Выбрать работу'}
  if (user.reg.workId) btnWork.text = `${user.reg.workType}: ${user.reg.work}`

  const btnDetailNum = {text: 'Выбрать № детали'}
  if (user.reg.detailNum && !user.reg.allDetailsAtOnce) btnDetailNum.text =
    `Выбрана деталь № ${user.reg.detailNum} (остаток ${quantity} шт.)`

  return [
      [{text: btnOrderNum.text,   switch_inline_query_current_chat: 'ShowOrderNums '}],
      [{text: btnWork.text,       switch_inline_query_current_chat: 'ShowWorks '}],
      [{text: 'Выбрать все детали',callback_data: 'Registration Set allDetailsAtOnce true'}],
      [{text: btnDetailNum.text,  switch_inline_query_current_chat: 'ShowDetailNums '}],
      [{text: maxText,            callback_data: maxCall},
       {text: minText,            callback_data: minCall},
       {text: manualText,         callback_data: `pass` }],
      [{text: `Назад`,            callback_data: `Меню НазадГлавное`},
       {text: confirmText,        callback_data: confirmCall}]
  ]
}

function createButtons() {
  addCurrentFuncToTrace()
  switch (user.menuSection){
    case 'WriteOffMenu':
      return createButtonsWriteOffMenu()
    case 'AddMenu':
      return createButtonsAddMenu()
  }
  return createButtonsMainMenu()
}

function createButtonsWriteOffMenu() {
  addCurrentFuncToTrace()
  if (!user.writeOff.selectedGroup) {
    return createButtonsWriteOffMenuLevelOne()
  } else {
    return createButtonsWriteOffMenuLevelTwo()
  }
}

function createButtonsWriteOffMenuLevelOne() {
  addCurrentFuncToTrace()
  const groups = {}
  for (const row of getTableStorage()) {
    const group = row[1]
    if (group === '') {continue}
    if (!(group in groups)) {
      groups[group] = 0
    }
    const residue = Number(row[11])
    if (residue > 0){
      groups[group]++
    }
  }
  const buttons = [{ "text": "Назад", 'callback_data': `Меню НазадГлавное` },
                   { "text": "➖ Общий поиск", 'switch_inline_query_current_chat': '' }]
  for (const groupName in groups) {
    buttons.push({ "text": `${groupName} (${groups[groupName]})`, 'callback_data': `Меню Показать ${groupName}`})
  }
  const buttonRows = []
  let count = buttons.length;
  if ((count % 2) === 0){
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  } else {
    count--
    buttonRows.push([buttons.shift()])
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  }
  buttonRows.push([{ "text": "# Поиск По номеру заказа", 'switch_inline_query_current_chat': '#' }])
  return buttonRows
}

function createButtonsWriteOffMenuLevelTwo() {
  addCurrentFuncToTrace()
  const subgroups = {}
  for (const row of getTableStorage()) {
    const group = row[1]
    const subgroup = row[2]
    if (group !== user.writeOff.selectedGroup) {continue}
    if (!(subgroup in subgroups)) {
      subgroups[subgroup] = 0
    }
    const residue = Number(row[11])
    if (residue > 0){
      subgroups[subgroup]++
    }
  }
  const buttons = [{ "text": "Назад", 'callback_data': `Меню Назад` }]
  for (const subgroupName in subgroups) {
    buttons.push({ "text": `${subgroupName} (${subgroups[subgroupName]})`, 'switch_inline_query_current_chat': subgroupName})
  }
  const buttonRows = []
  let count = buttons.length;
  if ((count % 2) === 0){
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  } else {
    count--
    buttonRows.push([buttons.shift()])
    for (const i of [...Array(count / 2).keys()]) {
      buttonRows.push([buttons[i], buttons[i + count / 2]])
    }
  }
  return buttonRows
}

function createButtonsAddMenu() {
  addCurrentFuncToTrace()
  const groups = {}
  for (const row of getTableNewPaint()) {
    const group = row[0]
    if (group === '') {continue}
    if (!(group in groups)) {
      groups[group] = 0
    }
    groups[group]++
  }
  const buttons = [{ "text": "Назад", 'callback_data': `Меню НазадГлавное` },
                   { "text": "➕Общий поиск", 'switch_inline_query_current_chat': '+' }]
  for (const groupName in groups) {
    buttons.push({ "text": `${groupName} (${groups[groupName]})`,
                   'switch_inline_query_current_chat': `+${groupName} `})
  }
  const buttonRows = []
  let count = buttons.length;
  if ((count % 2) === 0) {
    for (const i of [...Array(count).keys()]) {
      if ((i % 2) === 0) buttonRows.push([buttons[i], buttons[i + 1]])
    }
  } else {
    count--
    buttonRows.push([buttons.shift()])
    for (const i of [...Array(count).keys()]) {
      if ((i % 2) === 0) buttonRows.push([buttons[i], buttons[i + 1]])
    }
  }
  return buttonRows
}

function createButtonsMainMenu() {
  addCurrentFuncToTrace()
  const buttons = []
  if (isDemoOrUserEntitledTo(sections.writeOff)) buttons.push(
    [{"text": `➖Списание со склада`, 'callback_data': `Меню Списание`}]
  )
  if (isDemoOrUserEntitledTo(sections.addition)) buttons.push(
    [{"text": `➕Добавление на склад`, 'callback_data': `Меню Добавление`}]
  )
  if (isDemoOrUserEntitledTo(sections.registration)) buttons.push(
    [{"text": `💲Отчёт о работе`, 'callback_data': `Меню Регистрация`}]
  )
  return buttons
}

function isDemoOrUserEntitledTo(section) {
  if (!isUserAuthorized()) return true
  if (section === sections.writeOff) return user.rights.writeOff.any
  if (section === sections.addition) return user.rights.addition.any
  if (section === sections.registration) return user.rights.registration.any
}

function updateTrioMenu() {
  addCurrentFuncToTrace()
  const action = user.message ? user.message.text.replace('ТройноеМеню ', '')
                              : user.callback_query.data.replace('ТройноеМеню ', '')
  const field = action.split(' ')[0]
  let value = action.replace(`${field} `, '').replaceAll(' ', '')
  switch (field) {
    case 'Поставщик':
      user.addition.supplier = value; break
    case 'Стеллаж':
      user.addition.rack = value; break
    case 'Полка':
      user.addition.shelf = value; break
    case 'Заказ':
      user.addition.order = value; break
    default:
      return
  }
  saveUser()
  const keyboard = {inline_keyboard: createButtonsTrioMenu()}
  editMenuMessage(null, keyboard)
}

function createButtonsTrioMenu() {
  addCurrentFuncToTrace()
  const rows = [
    ['С1',  'П1', 'РГ ГРУПП'],
    ['С2',  'П2', 'Бонвио'],
    ['С3',  'П3', 'Sirca'],
    ['С4',  'П4', 'Лак Премьер'],
    ['С5',  'П5', 'техноколор '],
    ['С6',  'П6', 'Sayerlack'],
    [' ','П7', ' '],
    [' ','П8', ' '],
  ]
  const uA = user.addition
  const text = uA.order ? `Выбран заказ ${uA.order}` : 'Задать номер заказа'
  const buttonRows = [[{"text": text, 'switch_inline_query_current_chat': '#'}]]
  for (const row of rows) {
    const [rackName, shelfName, supplierName] = row
    const isselectedSupplierMark = uA.supplier === supplierName ? '✔' : ''
    const isSelectedRackMark = uA.rack === rackName ? '✔' : ''
    const isShelfMark = uA.shelf === shelfName ? '✔' : ''
    buttonRows.push([
        { "text": `${supplierName}${isselectedSupplierMark}`, 'callback_data': `ТройноеМеню Поставщик ${supplierName}`},
        { "text": `${rackName}${isSelectedRackMark}`, 'callback_data': `ТройноеМеню Стеллаж ${rackName}`},
        { "text": `${shelfName}${isShelfMark}`, 'callback_data': `ТройноеМеню Полка ${shelfName}`},
      ])
  }
  if (uA.supplier && uA.rack && uA.shelf) {
    buttonRows.push([
        {"text": `Назад`, 'callback_data': `Меню Добавление`},
        {"text": `Добавить ✓`, 'callback_data': `Добавить Да`},
      ])
  }
  else {
    buttonRows.push([
        {"text": `Назад`, 'callback_data': `Меню Добавление`},
        {"text": ` `, 'callback_data': `-`},
      ])
  }
  return buttonRows
}

function makeAddition() {
  addCurrentFuncToTrace()
  const uA = user.addition
  const date = toDate(user.callback_query.message.date)
  tableNewPaintAppend(uA.matName, uA.supplier, uA.order, uA.rack,
                      uA.shelf, uA.amount, date, getEmployeeName(user.id))
  const text = `👌 Добавлено ${uA.amount} кг ${clear(uA.matName)} от ${uA.supplier}, место ${uA.rack}-${uA.shelf}`
  editMenuMessage(text)
  user.addition = {}
  user.menuSection = null
  saveUser()
  greetUser()
}

function tableNewPaintAppend(){
  addCurrentFuncToTrace()
  const data = [[].slice.call(arguments)]
  setValuesUnderLastRow('СКЛАД', 4, data)
}

function setValuesUnderLastRow(sheetName, column, twoDimensionalArray, ssId = ssIdSpisanieColorit){
  addCurrentFuncToTrace()
  const sheet = getSs(ssId).getSheetByName(sheetName)
  const curRange = sheet.getRange(sheet.getMaxRows(), column)
  const row = curRange.getNextDataCell(SpreadsheetApp.Direction.UP).getLastRow() + 1
  const col = curRange.getLastColumn()
  const numRows = twoDimensionalArray.length
  const rowLenghts = twoDimensionalArray.map(row => row.length);
  const numCols = Math.max(...rowLenghts)
  const newRange = sheet.getRange(row, col, numRows, numCols)
  newRange.setValues(twoDimensionalArray)
}

function getEmployeeName(userId) {
  addCurrentFuncToTrace()
  for (const row of getTableUser()){
    if (row[0] === userId) return row[1]
  }
  return userId
}

function editMenuMessage(textNew=null, keyboardNew=null) {
  addCurrentFuncToTrace()
  if (!user.menuMessage) {
    greetUser()
    return;
  }
  const [messageId, textOld, keyboardOld] = Object.values(user.menuMessage)
  const isKbIdentical = JSON.stringify(keyboardOld) === JSON.stringify(keyboardNew)
  if (isKbIdentical && (textOld === textNew || !textNew)) return
  editMessage(user.id, messageId, textNew || textOld, keyboardNew)
  storeMenuMessage(messageId, textNew || textOld, keyboardNew)
}

function editAndForgetMenuMessage(textNew=null, keyboardNew=null) {
  addCurrentFuncToTrace()
  const [messageId, textOld, keyboardOld] = Object.values(user.menuMessage)
  const isKbIdentical = JSON.stringify(keyboardOld) === JSON.stringify(keyboardNew)
  if (isKbIdentical && (textOld === textNew || !textNew)) return
  editMessage(user.id, messageId, textNew || textOld, keyboardNew)
  user.menuMessage = null
}

function processRegistration() {
  addCurrentFuncToTrace()
  const action = user.callback_query ? user.callback_query.data.replace('Registration ', '')
                                     : user.message.text.replace('Registration ', '')
  const [operation, attrName, ...values] = action.split(' ')
  switch (operation) {
    case 'Set':
      user.reg[attrName] = values.join(' '); break
    case 'Apply':
      applyRegistration(); return
    case 'SetDetailNum':
      user.reg.detailNum = values.join(' ')
      user.reg.quantity = null
      user.reg.allDetailsAtOnce = null
      break
  }
  saveUser()
  if (user.message) deleteLastMessage()
  showRegistrationMenu()
}

function applyRegistration() {
  addCurrentFuncToTrace()
  const uR = user.reg
  if (!user.reg.quantity || !user.reg.detailNum) return
  const cachedTables1 = getCachedTables()
  if (user.reg.allDetailsAtOnce){
    const data = []
    for (const item of user.reg.allDetailsAtOnce) {
      data.push([user.lastVisit, user.id, uR.workType, uR.work, uR.orderNum,
                item.detailNum, item.quantity])
      const detail = cachedTables1.catalogOrders[uR.orderNum][item.detailNum];
      detail[uR.workId] -= item.quantity
      cachedTables1.catalogOrders[uR.orderNum][item.detailNum] = detail
    }
    tableRegistrationAppend(data)
    user.reg.workId = null
  }
  else {
    tableRegistrationAppend(user.lastVisit, user.id, uR.workType, uR.work, uR.orderNum, uR.detailNum, uR.quantity)
    const detail = cachedTables1.catalogOrders[uR.orderNum][uR.detailNum];
    detail[uR.workId] -= uR.quantity
    cachedTables1.catalogOrders[uR.orderNum][uR.detailNum] = detail
  }
  saveCachedTables(cachedTables1)
  const text = user.menuMessage.text.replace('Для отчёта о работе заполни форму',
                                             '👌 Отчёт о работе принят')
  user.reg.quantity = null
  user.reg.detailNum = null
  user.reg.allDetailsAtOnce = null
  saveUser()

  editAndForgetMenuMessage(text)
  showRegistrationMenu()
}

function tableRegistrationAppend(){
  addCurrentFuncToTrace()
  const args = [].slice.call(arguments)
  const isTwoDimentional = Object.prototype.toString.call(args[0]) === '[object Array]'
  const data = isTwoDimentional ? args[0] : [args]
  setValuesUnderLastRow('ЖУРНАЛ РАБОТ', 2, data, ssIdColSdelkaDetWorks)
}

function setSection() {
  addCurrentFuncToTrace()
  const section = user.message.text.replace('/section_', '')
  deleteLastMessage()
  switch (section) {
    case '0': {
      if (user.menuMessage) {
        const [messageId, _] = Object.values(user.menuMessage)
        deleteMessage(user.id, messageId)
        user.menuSection = null
        saveUser()
      }
      greetUser()
      break
    }
    case '1': switchMenu('Списание'); break
    case '2': switchMenu('Добавление'); break
    case '3': switchMenu('Регистрация'); break
  }
}

function greetUser() {
  addCurrentFuncToTrace()
  let text
  if (isUserAuthorized()) {
    text = `Привет, ${user.name}! Выбери секцию:`
  } else {
    text = `Привет, ${user.name}! Это демо-режим бота, т.к. твой id ${user.id} не зарегистрирован – действия не будут учтены в таблице. \nОбратись к администратору, чтобы тебя подключили к системе или давай продолжим так и просто потестим бота`
  }
  let keyboard = {inline_keyboard: createButtons()}
  let [_, messageId] = sendMessageToUser(text, keyboard)
  storeMessageId(messageId)
  storeMenuMessage(messageId, text, keyboard)
}

function sendMessageToUser(text, keyboard=null){
  addCurrentFuncToTrace()
  return sendMessage(user.id, text, keyboard)
}

function sendMessage(chatId, text, keyboard=null){
  const MAX_LENGTH = 4096;
  if (text.length > MAX_LENGTH){
    const prefix = `(Сообщение усечено до 4096 символов)\n`;
    const truncated = text.slice(0, MAX_LENGTH - prefix.length);
    text = prefix + truncated
  }
  let data = {
    method: 'post',
    payload: {
      method: 'sendMessage',
      chat_id: String(chatId),
      text: text,
      disable_notification: true,
      parse_mode: 'HTML',
      reply_markup: keyboard ? JSON.stringify(keyboard) : ''
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId]
}

function sendMessageToSG(text, keyboard=null){
  const SGrodnikChatId = 326258443
  return sendMessage(SGrodnikChatId, text, keyboard)
}

function selectMat() {
  addCurrentFuncToTrace()
  deleteLastMessage()
  if (user.menuSection === 'WriteOffMenu') selectMatWriteOff()
  if (user.menuSection === 'AddMenu') selectMatAddition()
}

function selectMatWriteOff() {
  addCurrentFuncToTrace()
  const mes = user.message.text.replaceAll('Выбрать ', '')
  let [matName, _, residue, matId] = machinize(mes)
  user.writeOff.matNameAndMatId = [matName, matId]
  saveUser()
  props.setProperty(matId, residue)
  let text = `Введи количество ≤ ${residue} кг`
  let [__, messageId] = sendMessageToUser(text)
  storeMessageId(messageId)
}

function machinize(s) {
  addCurrentFuncToTrace()
  s = s.replace(': ', '["')
  s = s + '"]'
  s = s.replaceAll(' | ', '","')
  s = s.replaceAll('Место ', '')
  s = s.replaceAll(' кг', '')
  s = s.replaceAll('id', '')
  return JSON.parse(s)
}

function storeMessageId(messageId=null) {
  addCurrentFuncToTrace()
  user.messages.push({id: messageId || user.message.message_id, date: user.lastVisit})
  saveUser()
}

function selectMatAddition() {
  addCurrentFuncToTrace()
  user.addition.matName = user.message.text.replaceAll('Выбрать ', '')
  saveUser()
  let text = `Введи количество ${clear(user.addition.matName)} в кг`
  editMenuMessage(text)
}

function selectNum() {
  addCurrentFuncToTrace()
  deleteLastMessage()
  if (user.menuSection === 'WriteOffMenu') selectNumWriteOff()
  if (user.menuSection === 'AddMenu') updateTrioMenu()
}

function selectNumWriteOff() {
  addCurrentFuncToTrace()
  const num = user.message.text.replaceAll('Заказ ', '');
  let keyboard = {inline_keyboard:
        [[{ "text": `Показать позиции по заказу ${num}`,
          'switch_inline_query_current_chat': `#${num}` }]]
  }
  let [_, messageId] = sendMessageToUser(`👇`, keyboard)
  storeMessageId(messageId)
}

function deleteLastMessage(){
  addCurrentFuncToTrace()
  deleteMessage(user.message.chat.id, user.message.message_id)
}

function isFloat(str){
  addCurrentFuncToTrace()
  str = str.replaceAll(',', '.')
  const allowedChars = ['1','2','3','4','5','6','7','8','9','0','.']
  for (let i = 0; i < str.length; i++) {
    if(!(allowedChars.includes(str[i]))){
      return false
    }
  }
  return !isNaN(str)
}

function confirmAmount() {
  addCurrentFuncToTrace()
  deleteLastMessage()
  if (user.menuSection === 'WriteOffMenu') confirmWriteOff()
  if (user.menuSection === 'AddMenu') confirmAddition()
  if (user.menuSection === 'RegistrationMenu') confirmRegistration()
}

function confirmWriteOff() {
  addCurrentFuncToTrace()
  let amount = String(parseFloat(user.message.text.replace(',', '.'))).replace('.', ',')
  let [matName, matId] = user.writeOff.matNameAndMatId
  const residue = props.getProperty(matId).replace(',', '.')
  if(parseFloat(amount.replace(',', '.')) > parseFloat(residue)){
    let caption = `Введи количество <b>≤ ${residue}</b> кг`
    let [_, messageId] = sendIncorrectInputAnimation(user.id, caption)
    storeMessageId(messageId)
    return
  }
  let text = `Подтверди списание <b>${amount}</b> кг <b>${matName}</b> или введи другое количество`
  let keyboard = {inline_keyboard:
        [[{ "text": `Списать ✓`, 'callback_data': `Списать ${amount}` }]]
  }
  sendMessageToUser(text, keyboard)
}

function confirmAddition() {
  addCurrentFuncToTrace()
  const amount = String(parseFloat(user.message.text.replace(',', '.'))).replace('.', ',')
  user.addition.amount = amount
  saveUser()
  let text = `Для добавления <b>${amount}</b> кг <b>${clear(user.addition.matName)}</b> выбери поставщика, стеллаж и полку или введи другое количество.`
  const keyboard = {inline_keyboard: createButtonsTrioMenu()}
  editMenuMessage(text, keyboard)
}

function confirmRegistration() {
  addCurrentFuncToTrace()
  user.reg.quantity = String(parseFloat(user.message.text.replace(',', '.'))).replace('.', ',')
  saveUser()
  showRegistrationMenu()
}

function incorrectInput() {
  addCurrentFuncToTrace()
  const caption = 'Я не понял что ты сказал, повтори еще раз'
  let [_, messageId] = sendIncorrectInputAnimation(user.id, caption)
  storeMessageId(messageId)
}

function sendIncorrectInputAnimation(chatId, caption=''){
  addCurrentFuncToTrace()
  const neozhidannoGif = 'CgACAgQAAxkBAAIHTWLNdvbly1yGur2EK9J6IRU9snfHAAImAwAC-0UFU_0l6KYHG0w9KQQ';
  let data = {
    method: 'post',
    payload: {
      method: 'sendAnimation',
      chat_id: String(chatId),
      animation: neozhidannoGif,
      disable_notification: true,
      parse_mode: 'HTML',
      caption: caption
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId]
}

function printToSG(text) {
  sendMessageToSG(text)
}

function printToSGOnce(text) {
  if (printToSGCounter === 0){
    printToSGCounter++
    printToSG(text)
  }
}

function printToSGOncePerValue(text) {
  if (!printToSGValues.includes(text)){
    printToSGValues.push(text)
    printToSG(text)
  }
}

function now(date=0){
  addCurrentFuncToTrace()
  if(!date){
    date = new Date()
  }
  let y = date.getFullYear()
  let m = date.getMonth() + 1
  let d = date.getDate()
  let hh = date.getHours()
  let mm = date.getMinutes()
  let ss = date.getSeconds()
  return `${y}.${m}.${d} ${hh}:${mm}:${ss}`
}

function tableAppend(){
  addCurrentFuncToTrace()
  const sheet = getSs(ssIdSpisanieColorit).getSheetByName('ЖУРНАЛ_ИСХОДНИК')
  sheet.appendRow([].slice.call(arguments))
}

function pass(){console.log(123)}

function ClearCache(){props.deleteAllProperties()}

function setMyCommands(){
  const botCommands = [
    {command: 'section_0', description: 'Главное меню'},
    {command: 'section_1', description: '1: Списание со склада'},
    {command: 'section_2', description: '2: Добавление на склад'},
    {command: 'section_3', description: '3: Отчет о работе'},
  ]
  let data = {
    method: 'post',
    payload: {
      method: 'setMyCommands',
      commands: JSON.stringify(botCommands),
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  Logger.log(JSON.parse(response.getContentText()))
}

function regularSelfCleaning() {
  const data = props.getProperties();
  for (const key in data) {
    if (!key.includes('User ')) continue
    user = JSON.parse(data[key])
    const res = []
    for (const message of user.messages) {
      const now = new Date()
      const messageDate = new Date(message.date)
      const hoursPassed = Math.abs(now - messageDate) / 36e5
      if (hoursPassed > 46 && hoursPassed < 48){
        deleteMessage(user.id, message.id)
        const logObject = {
          messageId: message.id,
          userId: user.id,
          userName: user.name,
          now, messageDate, hoursPassed
        }
        res.push('delete message ' + JSON.stringify(logObject))
      }
      Logger.log(user.name, '\n', now, '\n', messageDate, '\n',
        (now - messageDate) / 1000, hoursPassed)
    }
    if (res.length > 0){
      printToSG(res.join('\n'))
      const newMessages = []
      for (const message of user.messages) {
        const isMessageDeleted = res.map(o=>o.messageId).includes(message.id);
        if (isMessageDeleted) continue
        newMessages.push(message)
      }
      user.messages = newMessages
      const isMenuMessageDeleted =
        res.map(o=>o.messageId).includes(user.menuMessage.id);
      if (isMenuMessageDeleted) user.menuMessage = null
      saveUser()
    }

  }
}
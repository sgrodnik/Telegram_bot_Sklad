// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const ssId = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ssApp = SpreadsheetApp.openById(ssId)
const props = PropertiesService.getScriptProperties()

let update
let message

const DEBUG = 0

function doPost(e){
  try{
    update = JSON.parse(e.postData.contents)
    if(!update){
      throw Error('No contents')
    }
    DEBUG ? debug() : processMessage()
  }
  catch(e){
    const SGrodnikChatId = 326258443
    sendMessage(SGrodnikChatId, `${e}\n${update}`)
    tableAppend(now(), 'Ошибка', e)
  }
}

function debug(){
  const SGrodnikChatId = 326258443
    let properties = PropertiesService.getScriptProperties()
    properties.setProperty('qwe', 'asd')
    sendMessage(SGrodnikChatId, props.getProperties())

}

function processMessage(){
  message = update.message
  inline_query = update.inline_query
  if(inline_query){processInlineQuery()}
  if(update.callback_query && update.callback_query.data.startsWith('Списать')){writeOff()}
  if(message){storeMessageId()}
  if(message && message.text && message.text.startsWith('/s')){greetUser()}
  else if(message && message.text && message.text.startsWith('Обновить')){greetUser()}
  else if(message && message.text && message.text.startsWith('Выбрать')){selectMat()}
  else if(message && message.text && message.text.startsWith('Заказ')){selectNum()}
  else if(message && message.text && isFloat(message.text)){confirmWriteOff()}
  else if(message){incorrectInput()}
}

function storeMessageId(fromId=null, messageId=null) {
  const propName = `${fromId || message.from.id}messages`
  let storage = props.getProperty(propName)
  if (!storage) storage = []
  else storage = JSON.parse(storage)
  storage.push(messageId || message.message_id)
  props.setProperty(propName, JSON.stringify(storage))
}

function storeReportToEditNextTime(fromId, messageId, text) {
  const propName = `${fromId}messageToEdit`
  props.setProperty(propName, JSON.stringify([messageId, text]))
}

function deleteMessages(chatId=null, senderId=null) {
  const propName = `${senderId || message.from.id}messages`
  let storage = props.getProperty(propName)
  props.deleteProperty(propName)
  if (!storage) storage = []
  else storage = JSON.parse(storage)
  for (const messageId of storage) {
    deleteMessage(chatId || message.chat.id, messageId)
  }
}

function editPrevReport(chatId) {
  const propName = `${chatId}messageToEdit`
  let storage = props.getProperty(propName)
  if (!storage) return
  props.deleteProperty(propName)
  let [messageId, text] = JSON.parse(storage)
  editMessage(chatId, messageId, text)
}

function greetUser() {
  let text
  const userName = message.from.first_name || message.from.username;
  if(isUserAuthorized()) {
    text = `Привет, ${userName}! Давай найдём материал:`
  } else {
    text = `Привет, ${userName}! Это демо-режим бота, т.к. твой id ${message.from.id} не зарегистрирован (списания не будут учтены в таблице). \nОбратись к администратору, чтобы тебя подключили к системе или давай продолжим так и просто потестим бота`
  }
  let keyboard = {inline_keyboard: createButtonsByGroup()}
  let [chatId, messageId] = sendMessage(message.from.id, text, keyboard)
  storeMessageId(chatId, messageId)
}

function incorrectInput() {
  let [chatId, messageId] = sendIncorrectInputAnimation(message.from.id)
  storeMessageId(chatId, messageId)
}

function isUserAuthorized(userId=null) {
  let id = userId || message.from.id
  for (const row_ of getTableUser()){
    if (id === row_[0]){
      return true
    }
  }
  return false
}

function createButtonsByGroup() {
  const groups = {}
  for (const row of getTableStorage()) {
    const group = row[1]
    if (group === '') {continue}
    if (!(group in groups)) {
      groups[group] = 0
    }
    const ostatok = Number(row[10])
    if (ostatok > 0){
      groups[group]++
    }
  }
  const buttons = [{ "text": "🔍 Общий поиск", 'switch_inline_query_current_chat': '' }]
  for (const groupName in groups) {
    buttons.push({ "text": `${groupName} (${groups[groupName]})`, 'switch_inline_query_current_chat': groupName})
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
  buttonRows.push([{ "text": "🔍 Поиск По номеру заказа", 'switch_inline_query_current_chat': '#' }])
  return buttonRows
}

function selectMat() {
  const mes = message.text.replaceAll('Выбрать ', '');
  let [matName, _, ostatok, matId] = machinize(mes)
  props.setProperty(message.from.id, matName + ',id=' + matId)
  props.setProperty(matId, ostatok)
  let text = `Введите количество ≤ ${ostatok} кг`
  let [chatId, messageId] = sendMessage(message.from.id, text)
  storeMessageId(chatId, messageId)
}

function selectNum() {
  const num = message.text.replaceAll('Заказ ', '');
  let keyboard = {inline_keyboard:
        [[{ "text": `Показать позиции по заказу ${num}`,
          'switch_inline_query_current_chat': `#${num}` }]]
  }
  let [chatId, messageId] = sendMessage(message.from.id, `👇`, keyboard)
  storeMessageId(chatId, messageId)
}

function isFloat(str){
  str = str.replaceAll(',', '.')
  const allowedChars = ['1','2','3','4','5','6','7','8','9','0','.']
  for (let i = 0; i < str.length; i++) {
    if(!(allowedChars.includes(str[i]))){
      return false
    }
  }
  return !isNaN(str)
}

function confirmWriteOff() {
  let amount = String(parseFloat(message.text.replace(',', '.'))).replace('.', ',')
  let properties = PropertiesService.getScriptProperties()
  let [matName, matId] = properties.getProperty(message.from.id).split(',id=')
  const ostatok = props.getProperty(matId);
  if(parseFloat(amount.replace('.', ',')) > parseFloat(ostatok)){
    let text = `Введите количество <b>≤ ${ostatok}</b> кг`
    let [chatId, messageId] = sendMessage(message.from.id, text)
    storeMessageId(chatId, messageId)
    return
  }
  let text = `Подтвердите списание <b>${amount}</b> кг <b>${matName}</b> или введите другое количество`
  let keyboard = {inline_keyboard:
        [[{ "text": `Списать ✓`, 'callback_data': `Списать ${amount}` }]]
  }
  sendMessage(message.from.id, text, keyboard)
}

function writeOff() {
  const callbackQuery = update.callback_query
  const amount = callbackQuery.data.replace('Списать ', '')
  const properties = PropertiesService.getScriptProperties()
  const [matName, matId] = properties.getProperty(callbackQuery.from.id).split(',id=')
  const message = callbackQuery.message
  const date = toDate(message.date)
  tableAppend(date, callbackQuery.from.id, matId, amount)
  let ostatok = '?'
  for (const row of getTableStorage()) {
    if(String(row[0]) === matId){
      ostatok = row[10]
    }
  }
  props.setProperty(matId, ostatok)
  ostatok = String(Math.round(ostatok * 100) / 100).replaceAll('.', ',')
  const demo = isUserAuthorized(callbackQuery.from.id) ? '' : ' <tg-spoiler>, Демо-режим</tg-spoiler>'
  const text = `👌 списано <b>${amount}</b> кг <b>${matName}</b>, Остаток ${ostatok} кг${demo}`
  const keyboard = {inline_keyboard: createButtonsByGroup()}
  let [chatId, messageId] = editMessage(message.chat.id, message.message_id, text, keyboard)
  deleteMessages(message.chat.id, callbackQuery.from.id)
  editPrevReport(chatId)
  storeReportToEditNextTime(chatId, messageId, text)
}

function toDate(unixTimestamp){
  const milliseconds = unixTimestamp * 1000
  const dateObject = new Date(milliseconds)
  return now(date=dateObject)
}

function now(date=0){
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

function clear(s) {
  return String(s).replaceAll('\n', ' ').replaceAll('"', '')
}

function tableAppend(){
  const sheet = ssApp.getSheetByName('ЖУРНАЛ_ИСХОДНИК')
  sheet.appendRow([].slice.call(arguments))
}

function getTableStorage() {
  const sheet = ssApp.getSheetByName('СКЛАД')
  const range = sheet.getRange(4, 1, 500, 12)
  return range.getValues()
}

function getTableUser() {
  const sheet = ssApp.getSheetByName('ПОЛЬЗОВАТЕЛИ')
  const range = sheet.getRange(2, 1, 50, 1)
  return range.getValues()
}

function processInlineQuery(){
  const query = update.inline_query.query
  if (!query || query.length < 1){
    answerInlineQuery(update.inline_query.id, [])
    return
  }
  if (query === '#'){
    answerInlineQuery(update.inline_query.id, getOrderNumberInlineResults(query).slice(0, 50))
    return
  }
  answerInlineQuery(update.inline_query.id, getNameInlineResults(query).slice(0, 50))
}

function getNameInlineResults(query) {
  let results = []
  let counter = 0
  for (const row of getTableStorage()) {
    const id = row[0]
    const name = clear(row[2])
    const supplyer = row[3]
    const num = row[4]
    const stellaj = row[5]
    const polka = row[6]
    const place = stellaj + polka
    const condition = query.startsWith('#') ?
        '#' + num === query :
        name.toLowerCase().includes(query.toLowerCase())
    if (condition) {
      counter++
      const ostatok = String(Math.round(row[10] * 100) / 100).replaceAll('.', ',')
      const noZak = num === '-' || num === '' ? '' : ` | #${num}`
      const messageText = 'Выбрать ' + humanize(name, place, ostatok, id)
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `${name} | ${supplyer}${noZak}`,
        description: `Остаток ${ostatok} кг | Расположение: ${stellaj} ${polka}`,
        input_message_content: {message_text: messageText},
        thumb_url: row[11],
        thumb_width: Number(10),
        thumb_height: Number(10)
      })
    }
  }
  results = fillIfEmpty(results, query)
  return results;
}

function fillIfEmpty(results, query) {
  if (results.length === 0) {
    results.push({
      id: 1,
      type: 'article',
      title: `По запросу "${query}" ничего не найдено 👀 🤔`,
      input_message_content: {
        message_text: `-`
      }
    })
  }
  return results
}

function getOrderNumberInlineResults(query) {
  const orderNumbers = {}
  for (const row of getTableStorage()) {
    const num = row[4];
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

function answerInlineQuery(inline_query_id, results){
  let data = {
    method: 'post',
    payload: {
      method: 'answerInlineQuery',
      inline_query_id: String(inline_query_id),
      results: JSON.stringify(results),
      cache_time: Number(0)
    }
  }
  UrlFetchApp.fetch(base, data)
}

function sendMessage(chatId, text, keyboard=null){
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

function editMessage(chatId, messageId, text, keyboard=null){
  let data = {
    method: 'post',
    payload: {
      method: 'editMessageText',
      chat_id: String(chatId),
      message_id: Number(messageId),
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard ? JSON.stringify(keyboard) : ''
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId_ = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId_]
}

function deleteMessage(chatId, messageId){
  let data = {
    method: 'post',
    payload: {
      method: 'deleteMessage',
      chat_id: String(chatId),
      message_id: Number(messageId)
    }
  }
  let response = UrlFetchApp.fetch(base, data)
}

function sendIncorrectInputAnimation(chatId){
  const neozhidannoGif = 'CgACAgQAAxkBAAIHTWLNdvbly1yGur2EK9J6IRU9snfHAAImAwAC-0UFU_0l6KYHG0w9KQQ';
  let data = {
    method: 'post',
    payload: {
      method: 'sendAnimation',
      chat_id: String(chatId),
      animation: neozhidannoGif,
      disable_notification: true,
      parse_mode: 'HTML',
      caption: 'Я не понял что ты сказал, повтори еще раз'
    }
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId]
}

function humanize(name, place, ostatok, id) {
  let s = JSON.stringify([name, 'Место ' + place, ostatok + ' кг', 'id' + id])
  s = s.replace('["', ': ')
  s = s.replace('"]', '')
  s = s.replaceAll('","', ' | ')
  return s
}

function machinize(s) {
  s = s.replace(': ', '["')
  s = s + '"]'
  s = s.replaceAll(' | ', '","')
  s = s.replaceAll('Место ', '')
  s = s.replaceAll(' кг', '')
  s = s.replaceAll('id', '')
  return JSON.parse(s)
}

function pass(){console.log(123)}

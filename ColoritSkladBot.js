// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const ssId = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ssApp = SpreadsheetApp.openById(ssId)
const props = PropertiesService.getScriptProperties()

let update
// let message
// let user
// let inline_query
let user


const DEBUG = 0

function doPost(e){
  try{
    update = JSON.parse(e.postData.contents)
    createOrFetchUser()
    processUpdate()
  }
  catch(err){
    const text = `${err}\n\nUser: ${JSON.stringify(user, null, 4)}}`
    printToSG(text)
    // tableAppend(now(), 'Ошибка', text)
  }
}

function createOrFetchUser() {
  const paramName = update.message ? 'message'
                  : update.inline_query ? 'inline_query'
                  : update.callback_query ? 'callback_query'
                  : throw 'Unexpected incoming kind received'
  const param = update[paramName]
  user = JSON.parse(props.getProperty(`User ${param.from.id}`)) || {
    writeOff: Object(),
    addition: Object(),
    reg: Object(),
    messages: []
  }
  user.id = param.from.id
  user.name = param.from.first_name || param.from.username || param.from.last_name
  user.lastVisit = new Date()
  user.incomingKind = paramName
  user[user.incomingKind] = param
}

function processUpdate(){
  if(user.inline_query){
    processInlineQuery()
  }
  if(user.callback_query){
    if(user.callback_query.data.startsWith('Списать'))     writeOff()
    if(user.callback_query.data.startsWith('Меню'))        switchMenu()
    if(user.callback_query.data.startsWith('ТройноеМеню')) updateTrioMenu()
    if(user.callback_query.data.startsWith('Добавить'))    makeAddition()
  }
  if(user.message && user.message.text){
    if(user.message.text.startsWith('/section'))     setSection()
    else if(user.message.text.startsWith('/s'))      greetUser()
    else if(user.message.text.startsWith('Выбрать')) selectMat()
    else if(user.message.text.startsWith('Заказ'))   selectNum()
    else if(isFloat(user.message.text))              confirmAmount()
    else if(user.message){incorrectInput()}
  }
  // todo оповестить о непонятке и удалить
}

function processInlineQuery(){
  const query = user.inline_query.query
  let results
  if (!query || query.length < 1) results = []
  else if (query.startsWith('#') && user.menuSection === 'AddMenu')
    results = getOrderNumberAdditionInlineResults(query)
  else if (query === '#') results = getOrderNumberInlineResults(query)
  else if (query.startsWith('+') && query.length > 1) results = getNewPaintNameInlineResults(query)
  else results = getNameInlineResults(query)
  answerInlineQuery(user.inline_query.id, results.slice(0, 50))
}

function getOrderNumberAdditionInlineResults(query) {
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
  const sheet = ssApp.getSheetByName('НАСТРОЙКИ')
  const range = sheet.getRange(2, 1, 1000, 4)
  const result = {nums: []}
  for (const row of range.getValues()) {
    const num = row[1]
    if (row[1]) result.nums.push(num.toString())
  }
  return result
}

function fillIfEmpty(results, query) {
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
  const sheet = ssApp.getSheetByName('СКЛАД')
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
  const sheet = ssApp.getSheetByName('ПОЛЬЗОВАТЕЛИ')
  const range = sheet.getRange(3, 1, 50, 32)
  return range.getValues()
}

function getNewPaintNameInlineResults(query) {
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
  const sheet = ssApp.getSheetByName('КРАСКА')
  const range = sheet.getRange(43, 1, 5000, 6)
  const result = range.getValues()
  return result
}

function clear(s) {
  return String(s).replaceAll('\n', ' ').replaceAll('"', '')
}

function getNameInlineResults(query) {
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
  let s = JSON.stringify([name, 'Место ' + place, residue + ' кг', 'id' + id])
  s = s.replace('["', ': ')
  s = s.replace('"]', '')
  s = s.replaceAll('","', ' | ')
  return s
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

function writeOff() {
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
  storeMenuMessage(messageId, text)
}

function toDate(unixTimestamp){
  const milliseconds = unixTimestamp * 1000
  const dateObject = new Date(milliseconds)
  return now(date=dateObject)
}

function isUserAuthorized() {
  for (const row_ of getTableUser()){
    if (user.id === row_[0]){
      return true
    }
  }
  return false
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
    },
    muteHttpExceptions: true
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId_ = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId_]
}

function deleteMessages() {
  for (const message of user.messages) {
    deleteMessage(user.id, message.id)
  }
  user.messages.length = 0
  saveUser()
}

function deleteMessage(chatId, messageId){
  let data = {
    method: 'post',
    payload: {
      method: 'deleteMessage',
      chat_id: String(chatId),
      message_id: Number(messageId)
    },
    muteHttpExceptions: true
  }
  let response = UrlFetchApp.fetch(base, data)
}

function editPrevReport(chatId) {
  let [messageId, text] = user.reportMessage
  user.reportMessage = null
  saveUser()
  editMessage(chatId, messageId, text)
}

function storeReportToEditNextTime(fromId, messageId, text) {
  user.reportMessage = {id: messageId, text: text}
  saveUser()
}

function storeMenuMessage(messageId, text) {
  user.menuMessage = {id: messageId, text: text, keyboard: keyboard}
  saveUser()
}

function switchMenu(act=null) {
  const action = act || user.callback_query.data.replace('Меню ', '')
  switch (action.split(' ')[0]) {
    case 'Списание':
      user.menuSection = 'WriteOffMenu'; break
    case 'Добавление':
      user.menuSection = 'AddMenu'; break
    case 'Регистрация': {
      user.menuSection = 'RegistrationMenu'
      showRegistrationMenu()
      return
    }
    case 'Показать':
      user.writeOff.selectedGroup = action.replace('Показать ', ''); break
    case 'Назад':
      user.writeOff.selectedGroup = null; break
    case 'НазадГлавное':
      user.menuSection = null; break
  }
  saveUser()
  const keyboard = {inline_keyboard: createButtons()}
}

function createButtons() {
  switch (user.menuSection){
    case 'WriteOffMenu':
      return createButtonsWriteOffMenu()
    case 'AddMenu':
      return createButtonsAddMenu()
  }
  return createButtonsMainMenu()
}

function createButtonsWriteOffMenu() {
  if (!user.writeOff.selectedGroup) {
    return createButtonsWriteOffMenuLevelOne()
  } else {
    return createButtonsWriteOffMenuLevelTwo()
  }
}

function createButtonsWriteOffMenuLevelOne() {
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
  const buttons = [
    [{"text": `➖Списание`, 'callback_data': `Меню Списание`}],
    [{"text": `➕Добавление`, 'callback_data': `Меню Добавление`}],
  ]
  return buttons
}

function updateTrioMenu() {
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
  // if (uA.supplier && uA.rack && uA.shelf && uA.order) {
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
  const data = [[].slice.call(arguments)]
  setValuesUnderLastRow('СКЛАД', 4, data)
}

function setValuesUnderLastRow(sheetName, column, twoDimensionalArray){
  const sheet = ssApp.getSheetByName(sheetName)
  const curRange = sheet.getRange(sheet.getMaxRows(), column)
  const row = curRange.getNextDataCell(SpreadsheetApp.Direction.UP).getLastRow() + 1
  const col = curRange.getLastColumn()
  const numRows = twoDimensionalArray.length
  const numCols = Math.max(twoDimensionalArray.map(row => row.length))
  const newRange = sheet.getRange(row, col, numRows, numCols)
  newRange.setValues(twoDimensionalArray)
}

function getEmployeeName(userId) {
  for (const row of getTableUser()){
    if (row[0] === userId) return row[1]
  }
  return userId
}

function editMenuMessage(textNew=null, keyboard=null) {
  const [messageId, textOld] = Object.values(user.menuMessageId)
  editMessage(user.id, messageId, textNew || textOld, keyboard)
  storeMenuMessage(messageId, textNew)
}

function setSection() {
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
  if(isUserAuthorized()) {
    text = `Привет, ${user.name}! Давай найдём материал:`
  } else {
    text = `Привет, ${user.name}! Это демо-режим бота, т.к. твой id ${user.id} не зарегистрирован – действия не будут учтены в таблице. \nОбратись к администратору, чтобы тебя подключили к системе или давай продолжим так и просто потестим бота`
  }
  let keyboard = {inline_keyboard: createButtons()}
  let [chatId, messageId] = sendMessageToUser(text, keyboard)
  storeMessageId(chatId, messageId)
  storeMenuMessage(messageId, text)
}

function sendMessageToUser(text, keyboard=null){
  return sendMessage(user.id, text, keyboard)
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

function sendMessageToSG(text, keyboard=null){
  const SGrodnikChatId = 326258443
  return sendMessage(SGrodnikChatId, text, keyboard)
}

function selectMat() {
  if (user.menuSection === 'WriteOffMenu') selectMatWriteOff()
  if (user.menuSection === 'AddMenu') selectMatAddition()
  deleteLastMessage()
}

function selectMatWriteOff() {
  const mes = user.message.text.replaceAll('Выбрать ', '')
  let [matName, _, residue, matId] = machinize(mes)
  user.writeOff.matNameAndMatId = [matName, matId]
  saveUser()
  props.setProperty(matId, residue)
  let text = `Введи количество ≤ ${residue} кг`
  let [chatId, messageId] = sendMessageToUser(text)
  storeMessageId(chatId, messageId)
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

function storeMessageId(messageId=null) {
  user.messages.push(messageId || user.message.message_id)
  saveUser()
}

function selectMatAddition() {
  user.addition.matName = user.message.text.replaceAll('Выбрать ', '')
  saveUser()
  let text = `Введи количество ${clear(user.addition.matName)} в кг`
  editMenuMessage(text)
}

function selectNum() {
  if (user.menuSection === 'WriteOffMenu') selectNumWriteOff()
  if (user.menuSection === 'AddMenu') updateTrioMenu()
  deleteLastMessage()
}

function selectNumWriteOff() {
  const num = user.message.text.replaceAll('Заказ ', '');
  let keyboard = {inline_keyboard:
        [[{ "text": `Показать позиции по заказу ${num}`,
          'switch_inline_query_current_chat': `#${num}` }]]
  }
  let [chatId, messageId] = sendMessageToUser(`👇`, keyboard)
  storeMessageId(chatId, messageId)
}

function deleteLastMessage(){
  deleteMessage(user.message.chat.id, user.message.message_id)
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

function confirmAmount() {
  if (user.menuSection === 'WriteOffMenu') confirmWriteOff()
  if (user.menuSection === 'AddMenu') confirmAddition()
  deleteLastMessage()
}

function confirmWriteOff() {
  let amount = String(parseFloat(user.message.text.replace(',', '.'))).replace('.', ',')
  let [matName, matId] = user.writeOff.matNameAndMatId
  const residue = props.getProperty(matId).replace(',', '.')
  if(parseFloat(amount.replace(',', '.')) > parseFloat(residue)){
    let caption = `Введи количество <b>≤ ${residue}</b> кг`
    let [chatId, messageId] = sendIncorrectInputAnimation(user.id, caption)
    storeMessageId(chatId, messageId)
    return
  }
  let text = `Подтверди списание <b>${amount}</b> кг <b>${matName}</b> или введи другое количество`
  let keyboard = {inline_keyboard:
        [[{ "text": `Списать ✓`, 'callback_data': `Списать ${amount}` }]]
  }
  sendMessageToUser(text, keyboard)
}

function confirmAddition() {
  const amount = String(parseFloat(user.message.text.replace(',', '.'))).replace('.', ',')
  user.addition.amount = amount
  saveUser()
  let text = `Для добавления <b>${amount}</b> кг <b>${clear(user.addition.matName)}</b> выбери поставщика, стеллаж и полку или введи другое количество.`
  const keyboard = {inline_keyboard: createButtonsTrioMenu()}
  editMenuMessage(text, keyboard)
}

function incorrectInput() {
  const caption = 'Я не понял что ты сказал, повтори еще раз'
  let [chatId, messageId] = sendIncorrectInputAnimation(user.id, caption)
  storeMessageId(chatId, messageId)
}

function sendIncorrectInputAnimation(chatId, caption=''){
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

function tableAppend(){
  const sheet = ssApp.getSheetByName('ЖУРНАЛ_ИСХОДНИК')
  sheet.appendRow([].slice.call(arguments))
}

function pass(){console.log(123)}

function ClearCache(){props.deleteAllProperties()}

function setMyCommands(){
  const map = Array.prototype.map;
  const botCommands = [
    // {command: command, description: description},
    {command: 'section_0', description: 'Главное меню'},
    {command: 'section_1', description: 'Секция 1: Списание материалов'},
    {command: 'section_2', description: 'Секция 2: Добавление материалов'},
    {command: 'section_3', description: 'Секция 2: Регистрация деталей'},
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
// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const ssId = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ssApp = SpreadsheetApp.openById(ssId)
const props = PropertiesService.getScriptProperties()

let update
let message
let userId
let inline_query

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
    const text = `${e}\n${JSON.stringify(update)}`
    printToSG(text)
    tableAppend(now(), 'Ошибка', text)
  }
}

function printToSG(text) {
  const SGrodnikChatId = 326258443
  sendMessage(SGrodnikChatId, text)
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
  userId = message ? message.from.id : inline_query ? inline_query.from.id : update.callback_query.from.id
  if(inline_query){processInlineQuery()}
  if(update.callback_query && update.callback_query.data.startsWith('Списать')){writeOff()}
  if(update.callback_query && update.callback_query.data.startsWith('Меню')){switchMenu()}
  if(update.callback_query && update.callback_query.data.startsWith('ТройноеМеню')){updateTrioMenu()}
  if(update.callback_query && update.callback_query.data.startsWith('Добавить')){makeAddition()}
  if(message && message.text && message.text.startsWith('/s')){greetUser()}
  else if(message && message.text && message.text.startsWith('Выбрать')){selectMat()}
  else if(message && message.text && message.text.startsWith('Заказ')){selectNum()}
  else if(message && message.text && isFloat(message.text)){confirmAmount()}
  else if(message){incorrectInput()}
}

function switchMenu() {
  const action = update.callback_query.data.replace('Меню ', '')
  switch (action.split(' ')[0]) {
    case 'Списание':
      props.setProperty(`${userId}MenuSection`, 'WriteOffMenu'); break
    case 'Добавление':
      props.setProperty(`${userId}MenuSection`, 'AddMenu'); break
    case 'Показать':
      const selectedGroup = action.replace('Показать ', '')
      props.setProperty(`${userId}SelectedGroup`, selectedGroup); break
    case 'Назад':
      props.deleteProperty(`${userId}SelectedGroup`); break
    case 'НазадГлавное':
      props.deleteProperty(`${userId}MenuSection`); break
  }
  let storage = props.getProperty(`${userId}MenuMessageId`)
  let [messageId, text] = JSON.parse(storage)
  const keyboard = {inline_keyboard: createButtons()}
  editMessage(userId, messageId, text, keyboard)
}

function storeMessageId(fromId=null, messageId=null) {
  const propName = `${fromId || userId}messages`
  let storage = props.getProperty(propName)
  if (!storage) storage = []
  else storage = JSON.parse(storage)
  storage.push(messageId || message.message_id)
  props.setProperty(propName, JSON.stringify(storage))
}

function storeMenuMessage(messageId, text) {
  const propName = `${userId}MenuMessageId`
  props.setProperty(propName, JSON.stringify([messageId, text]))
}

function storeReportToEditNextTime(fromId, messageId, text) {
  const propName = `${fromId}messageToEdit`
  props.setProperty(propName, JSON.stringify([messageId, text]))
}

function deleteMessages(chatId=null, senderId=null) {
  const propName = `${senderId || userId}messages`
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
  const userNameSource = message || update.callback_query
  const userName = userNameSource.from.first_name || userNameSource.from.username;
  if(isUserAuthorized()) {
    text = `Привет, ${userName}! Давай найдём материал:`
  } else {
    text = `Привет, ${userName}! Это демо-режим бота, т.к. твой id ${userId} не зарегистрирован – действия не будут учтены в таблице. \nОбратись к администратору, чтобы тебя подключили к системе или давай продолжим так и просто потестим бота`
  }
  let keyboard = {inline_keyboard: createButtons()}
  let [chatId, messageId] = sendMessage(userId, text, keyboard)
  storeMessageId(chatId, messageId)
  storeMenuMessage(messageId, text)
}

function incorrectInput() {
  const caption = 'Я не понял что ты сказал, повтори еще раз'
  let [chatId, messageId] = sendIncorrectInputAnimation(userId, caption)
  storeMessageId(chatId, messageId)
}

function isUserAuthorized() {
  for (const row_ of getTableUser()){
    if (userId === row_[0]){
      return true
    }
  }
  return false
}

function createButtons() {
  const menuSection = props.getProperty(`${userId}MenuSection`)
  switch (menuSection){
    case 'WriteOffMenu':
      return createButtonsWriteOffMenu()
    case 'AddMenu':
      return createButtonsAddMenu()
  }
  return createButtonsMainMenu()
}

function createButtonsMainMenu() {
  const buttons = [
    [{"text": `➖Списание`, 'callback_data': `Меню Списание`}],
    [{"text": `➕Добавление`, 'callback_data': `Меню Добавление`}],
  ]
  return buttons
}

function createButtonsWriteOffMenu() {
  const selectedGroup = props.getProperty(`${userId}SelectedGroup`)
  if (!selectedGroup) {
    return createButtonsWriteOffMenuLevelOne()
  } else {
    return createButtonsWriteOffMenuLevelTwo(selectedGroup)
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
   const selectedGroup = props.getProperty(`${userId}SelectedGroup`)
   for (const row of getTableStorage()) {
     const group = row[1]
     const subgroup = row[2]
     if (group !== selectedGroup) {continue}
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


function selectMat() {
  let section = props.getProperty(`${userId}MenuSection`)
  if (section === 'WriteOffMenu') {
    selectMatWriteOff()
  } else if (section === 'AddMenu') {
    selectMatAddition()
  }
  deleteLastMessage()
}

function selectMatWriteOff() {
  const mes = message.text.replaceAll('Выбрать ', '')
  let [matName, _, residue, matId] = machinize(mes)
  props.setProperty(userId, matName + ',id=' + matId)
  props.setProperty(matId, residue)
  let text = `Введи количество ≤ ${residue} кг`
  let [chatId, messageId] = sendMessage(userId, text)
  storeMessageId(chatId, messageId)
}

function selectMatAddition() {
  const matName = message.text.replaceAll('Выбрать ', '');
  const user = getCachedUser()
  user.AddMatName = matName
  saveCachedUser(user)

  let text = `Введи количество ${clear(user.AddMatName)} в кг`
  let storage = props.getProperty(`${userId}MenuMessageId`)
  let [messageId, _] = JSON.parse(storage)
  editMessage(userId, messageId, text)
  storeMenuMessage(messageId, text)
}

function confirmAddition() {
  const amount = String(parseFloat(message.text.replace(',', '.'))).replace('.', ',')
  const user = getCachedUser()
  user.Amount = amount
  saveCachedUser(user)
  let text = `Для добавления <b>${amount}</b> кг <b>${clear(user.AddMatName)}</b> выбери поставщика, стеллаж и полку или введи другое количество.`
  let storage = props.getProperty(`${userId}MenuMessageId`)
  let [messageId, _] = JSON.parse(storage)
  const keyboard = {inline_keyboard: createButtonsTrioMenu()}
  editMessage(userId, messageId, text, keyboard)
  storeMenuMessage(messageId, text)
}

function getCachedUser() {
  const obj = JSON.parse(props.getProperty(`User ${userId}`)) || Object()
  obj.Id = userId
  return obj
}

function saveCachedUser(user) {
  props.setProperty(`User ${userId}`, JSON.stringify(user))
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
  const user = getCachedUser()
  const text = user.Order ? `Выбран заказ ${user.Order}` : 'Задать номер заказа'
  const buttonRows = [[{"text": text, 'switch_inline_query_current_chat': '#'}]]
  for (const row of rows) {
    const [rackName, shelfName, supplierName] = row
    const isSelectedSupplierMark = user.SelectedSupplier === supplierName ? '✔' : ''
    const isSelectedRackMark = user.SelectedRack === rackName ? '✔' : ''
    const isSelectedShelfMark = user.SelectedShelf === shelfName ? '✔' : ''
    buttonRows.push([
        { "text": `${supplierName}${isSelectedSupplierMark}`, 'callback_data': `ТройноеМеню Поставщик ${supplierName}`},
        { "text": `${rackName}${isSelectedRackMark}`, 'callback_data': `ТройноеМеню Стеллаж ${rackName}`},
        { "text": `${shelfName}${isSelectedShelfMark}`, 'callback_data': `ТройноеМеню Полка ${shelfName}`},
      ])
  }
  // if (user.SelectedSupplier && user.SelectedRack && user.SelectedShelf && user.Order) {
  if (user.SelectedSupplier && user.SelectedRack && user.SelectedShelf) {
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

function updateTrioMenu() {
  const action = message ? message.text.replace('ТройноеМеню ', '')
                         : update.callback_query.data.replace('ТройноеМеню ', '')
  const user = getCachedUser()
  const field = action.split(' ')[0]
  let value = action.replace(`${field} `, '').replaceAll(' ', '')
  let isChanged = false
  switch (field) {
    case 'Поставщик':
      isChanged = user.SelectedSupplier !== value
      user.SelectedSupplier = value; break
    case 'Стеллаж':
      isChanged = user.SelectedRack !== value
      user.SelectedRack = value; break
    case 'Полка':
      isChanged = user.SelectedShelf !== value
      user.SelectedShelf = value; break
    case 'Заказ':
      isChanged = user.Order !== value
      user.Order = value; break
  }
  saveCachedUser(user)
  let storage = props.getProperty(`${userId}MenuMessageId`)
  let [messageId, text] = JSON.parse(storage)
  const keyboard = {inline_keyboard: createButtonsTrioMenu()}
  if (isChanged) editMessage(userId, messageId, text, keyboard)
  storeMenuMessage(messageId, text)
}

function makeAddition() {
  const callbackQuery = update.callback_query
  const message = callbackQuery.message
  const date = toDate(message.date)
  const user = getCachedUser()
  tableNewPaintAppend(user.AddMatName, user.SelectedSupplier, user.Order, user.SelectedRack,
                      user.SelectedShelf, user.Amount, date, getEmployeeName(user.Id))
  const text = `👌 Добавлено ${user.Amount} кг ${clear(user.AddMatName)} от ${user.SelectedSupplier}, место ${user.SelectedRack}-${user.SelectedShelf}`
  editMenuMessage(text)
  clearCachedUserAdditionSection()
  props.deleteProperty(`${userId}MenuSection`)
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
  const storage = props.getProperty(`${userId}MenuMessageId`)
  const [messageId, textOld] = JSON.parse(storage)
  editMessage(userId, messageId, textNew || textOld, keyboard)
  storeMenuMessage(messageId, textNew)
}

function clearCachedUserAdditionSection() {
  const user = getCachedUser()
  user.AddMatName = null
  user.Amount = null
  user.SelectedSupplier = null
  user.SelectedRack = null
  user.SelectedShelf = null
  user.Order = null
  saveCachedUser(user)
}

function selectNum() {
  let section = props.getProperty(`${userId}MenuSection`)
  if (section === 'WriteOffMenu') selectNumWriteOff()
  if (section === 'AddMenu') updateTrioMenu()
  deleteLastMessage()
}

function selectNumWriteOff() {
  const num = message.text.replaceAll('Заказ ', '');
  let keyboard = {inline_keyboard:
        [[{ "text": `Показать позиции по заказу ${num}`,
          'switch_inline_query_current_chat': `#${num}` }]]
  }
  let [chatId, messageId] = sendMessage(userId, `👇`, keyboard)
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

function confirmAmount() {
  let section = props.getProperty(`${userId}MenuSection`)
  if (section === 'WriteOffMenu') {
    confirmWriteOff()
  } else if (section === 'AddMenu') {
    confirmAddition()
  }
  deleteLastMessage()
}

function confirmWriteOff() {
  let amount = String(parseFloat(message.text.replace(',', '.'))).replace('.', ',')
  let properties = PropertiesService.getScriptProperties()
  let [matName, matId] = properties.getProperty(userId).split(',id=')
  const residue = props.getProperty(matId).replace(',', '.')
  if(parseFloat(amount.replace(',', '.')) > parseFloat(residue)){
    let caption = `Введи количество <b>≤ ${residue}</b> кг`
    let [chatId, messageId] = sendIncorrectInputAnimation(userId, caption)
    storeMessageId(chatId, messageId)
    return
  }
  let text = `Подтверди списание <b>${amount}</b> кг <b>${matName}</b> или введи другое количество`
  let keyboard = {inline_keyboard:
        [[{ "text": `Списать ✓`, 'callback_data': `Списать ${amount}` }]]
  }
  sendMessage(userId, text, keyboard)
}

function writeOff() {
  const callbackQuery = update.callback_query
  const amount = callbackQuery.data.replace('Списать ', '')
  const properties = PropertiesService.getScriptProperties()
  const [matName, matId] = properties.getProperty(userId).split(',id=')
  const message = callbackQuery.message
  const date = toDate(message.date)
  tableAppend(date, userId, matId, amount)
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
  deleteMessages(message.chat.id, userId)
  editPrevReport(chatId)
  storeReportToEditNextTime(chatId, messageId, text)
  storeMenuMessage(messageId, text)
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
  const range = sheet.getRange(4, 1, 500, 13)
  const result = []
  let allowedGroups = getAllowedGroups(userId)
  for (const row of range.getValues()) {
    const subgroup = row[2]
    const residue = Number(row[11])
    if (allowedGroups.includes(subgroup) && residue > 0) result.push(row)
  }
  return result
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

function getTableNewPaint() {
  const sheet = ssApp.getSheetByName('КРАСКА')
  const range = sheet.getRange(43, 1, 5000, 6)
  const result = range.getValues()
  return result
}

function processInlineQuery(){
  const query = update.inline_query.query
  const isAdditionSection = props.getProperty(`${userId}MenuSection`) === 'AddMenu'
  let results
  if (!query || query.length < 1) results = []
  else if (query.startsWith('#') && isAdditionSection) results = getOrderNumberAdditionInlineResults(query)
  else if (query === '#') results = getOrderNumberInlineResults(query)
  else if (query.startsWith('+') && query.length > 1) results = getNewPaintNameInlineResults(query)
  else results = getNameInlineResults(query)
  answerInlineQuery(update.inline_query.id, results.slice(0, 50))
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
    },
    muteHttpExceptions: true
  }
  let response = UrlFetchApp.fetch(base, data)
  let chatId_ = JSON.parse(response.getContentText()).result.chat.id
  let messageId_ = JSON.parse(response.getContentText()).result.message_id
  return [chatId_, messageId_]
}

function deleteLastMessage(){
  deleteMessage(message.chat.id, message.message_id)
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

function humanize(name, place, residue, id) {
  let s = JSON.stringify([name, 'Место ' + place, residue + ' кг', 'id' + id])
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

function ClearCache(){props.deleteAllProperties()}

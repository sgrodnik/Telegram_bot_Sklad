// wrapper: https://script.google.com/home/projects/1xxcmtRKO5Xe7a0dBeZ_Ypo-s-5xgam9-loG-Nsd1RfcfGkpLa1CY0UYz/edit
const base = 'https://api.telegram.org/bot' + token + '/'
const ssIdSpisanieColorit = '1dldSXJPoAj0Ni5G-LuklyOhBIqTn_BIfkMt5oeO4EoI'
const ss = SpreadsheetApp.openById(ssIdSpisanieColorit)
const ssIdColSdelkaDetWorks = '1BusvTFU8zoEIg727bk6IxBe88S-B2WfFxLHux7xc4BY'
const ssIdSdelka = '1jf-3SuKyVneiQNWv7616OOrZLP7UGK8qrvhw2AGQSqI'
const props = PropertiesService.getScriptProperties()

let update
let user
let cachedTables


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
                  : null
  if (!paramName) throw 'Unexpected incoming kind received'
  const param = update[paramName]
  user = JSON.parse(props.getProperty(`User ${param.from.id}`)) || {
    writeOff: Object(),
    addition: Object(),
    reg: Object(),
    messages: []
  }
  user.id = param.from.id
  user.name = param.from.first_name || param.from.username || param.from.last_name
  user.message = update.message
  user.inline_query = update.inline_query
  user.callback_query = update.callback_query
  user.lastVisit = new Date()
  user.debug = {functions: [arguments.callee.name]}
}

function addCurrentFuncToTrace() {
  user.debug.functions.push(arguments.callee.caller.name)
  saveUser()
}

function processUpdate(){
  addCurrentFuncToTrace()
  if(user.inline_query){
    processInlineQuery()
  }
  if(user.callback_query){
    if(user.callback_query.data.startsWith('Списать'))      writeOff()
    if(user.callback_query.data.startsWith('Меню'))         switchMenu()
    if(user.callback_query.data.startsWith('ТройноеМеню'))  updateTrioMenu()
    if(user.callback_query.data.startsWith('Добавить'))     makeAddition()
    if(user.callback_query.data.startsWith('Registration')) processRegistration()
  }
  if(user.message && user.message.text){
    if(user.message.text.startsWith('/section'))          setSection()
    else if(user.message.text.startsWith('/s'))           greetUser()
    else if(user.message.text.startsWith('Выбрать'))      selectMat()
    else if(user.message.text.startsWith('Заказ'))        selectNum()
    else if(user.message.text.startsWith('Registration')) processRegistration()
    else if(isFloat(user.message.text))                   confirmAmount()
    else if(user.message)                                 incorrectInput()
  }
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
  let results = []
  let counter = 0
  if (query.startsWith('ShowWorks')) {
    query = query.replace('ShowWorks', '').trim()
    const works = getTablesRegistration('works')
    for (const work of works[user.reg.workType] || []) {
      counter++
      if (query && !work.toLowerCase().includes(query.toLowerCase())) continue
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `${user.reg.workType}: ${work}`,
        input_message_content: {
          message_text: 'Registration Set work ' + work
        }
      })
    }
  }
  if (query.startsWith('ShowOrderNums')) {
    query = query.replace('ShowOrderNums', '').trim()
    const details = getTablesRegistration('details')
    const unique = []
    for (const detail of details) {
      if (unique.includes(detail.orNum)) continue
      unique.push(detail.orNum)
      counter++
      if (query && !detail.orNum.toLowerCase().includes(query.toLowerCase())) continue
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `Заказ № ${detail.orNum}`,
        input_message_content: {
          message_text: 'Registration Set orderNum ' + detail.orNum
        }
      })
    }
  }
  if (query.startsWith('ShowDetailNums')) {
    query = query.replace('ShowDetailNums', '').trim()
    const details = getTablesRegistration('details')
    for (const detail of details) {
      if (user.reg.orderNum !== detail.orNum) continue
      counter++
      if (query && !detail.detNum.toLowerCase().includes(query.toLowerCase())) continue
      results.push({
        id: counter.toString(),
        type: 'article',
        title: `Деталь ${detail.detNum}: ${detail.size} - ${detail.quantity} шт.`,
        input_message_content: {
          message_text: 'Registration Set detailNum ' + detail.detNum
        }
      })
    }
  }

  results = fillIfEmpty(results, query)
  return results
}

function getTablesRegistration(what) {
  addCurrentFuncToTrace()
  if (what === 'details'){
    const details = []
    for (const row of getCachedTables().details) {
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
  const works = {}
  for (const row of getCachedTables().works) {
    const kind = row[0]
    const work = row[2]
    if (!(kind in works)) works[kind] = []
    works[kind].push(work)
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
  const sheet = ss.getSheetByName('НАСТРОЙКИ')
  const range = sheet.getRange(2, 1, 1000, 4)
  const result = {nums: []}
  for (const row of range.getValues()) {
    const num = row[1]
    if (num) result.nums.push(num.toString())
  }
  return result
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
  const sheet = ss.getSheetByName('СКЛАД')
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
  const sheet = ss.getSheetByName('ПОЛЬЗОВАТЕЛИ')
  const range = sheet.getRange(3, 1, 50, 32)
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
  const sheet = ss.getSheetByName('КРАСКА')
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
      cache_time: Number(0)
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
  let response = UrlFetchApp.fetch(base, data)
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
      user.menuSection = 'WriteOffMenu'; break
    case 'Добавление':
      user.menuSection = 'AddMenu'; break
    case 'Регистрация': {
      user.menuSection = 'RegistrationMenu'
      cacheRegistrationTables()
      showRegistrationMenu()
      return
    }
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
  const ss = SpreadsheetApp.openById(ssIdColSdelkaDetWorks)
  const sheetD = ss.getSheetByName('Детали')
  const rangeDetails = sheetD.getRange(2, 1, sheetD.getMaxRows(), 4)
  const sheetW = ss.getSheetByName('Работы')
  const rangeWorks = sheetW.getRange(2, 1, sheetW.getMaxRows(), 3)
  cachedTables = {
    details: rangeDetails.getValues(),
    works: rangeWorks.getValues()
  }
  props.setProperty('cachedTables', JSON.stringify(cachedTables))
}

function getCachedTables() {
  return cachedTables || JSON.parse(props.getProperty('cachedTables'))
}

function showRegistrationMenu() {
  addCurrentFuncToTrace()
  const text = `Для регистрации деталей заполни форму:
Вид работ: ${user.reg.workType || '-'}
Работа: ${user.reg.work || '-'}
№ заказа: ${user.reg.orderNum || '-'}
№ детали: ${user.reg.detailNum || '-'}
Количество деталей: ${user.reg.quantity || '-'}`
  const keyboard = {inline_keyboard: createButtonsRegistrationMenu()}
  editMenuMessage(text, keyboard)
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
  if (user.reg.orderNum && user.reg.detailNum){
    const selectedDetail = getTablesRegistration('details').filter(d =>
      d.orNum.toString() === user.reg.orderNum &&
      d.detNum.toString() === user.reg.detailNum)[0]
    if (selectedDetail){
      if (selectedDetail.quantity > 1){
        maxCall = `Registration Set quantity ${selectedDetail.quantity}`
        maxText = `Все ${selectedDetail.quantity} шт.`
        minCall = `Registration Set quantity ${1}`
        minText = '1 шт.'
        manualText = '(либо введи)'
      }
      if (selectedDetail.quantity === 1){
        minCall = `Registration Set quantity ${1}`
        minText = 'Всего 1 шт.'
      }

    }
  }
  if (
    user.reg.workType &&
    user.reg.work &&
    user.reg.orderNum &&
    user.reg.detailNum &&
    user.reg.quantity
  ) {
    confirmCall = 'Registration Apply'
    confirmText = 'Зарегистрировать ✓'
  }
  return [
      [{"text": "Фрезеровка",         'callback_data': `Registration Set workType Фрезеровка`},
       {"text": "Прямые",             'callback_data': `Registration Set workType Прямые`},
       {"text": "Шпон/стол.",         'callback_data': `Registration Set workType Шпон/стол.`}],
      [{"text": "Выбрать работу",     'switch_inline_query_current_chat': 'ShowWorks '}],
      [{"text": "Выбрать № заказа",   'switch_inline_query_current_chat': 'ShowOrderNums '}],
      [{"text": "Выбрать № детали",   'switch_inline_query_current_chat': 'ShowDetailNums '}],
      [{"text": maxText,              'callback_data': maxCall},
       {"text": minText,              'callback_data': minCall},
       {"text": manualText,           'callback_data': `pass` }],
      [{"text": `Назад`,              'callback_data': `Меню НазадГлавное`},
       {"text": confirmText,          'callback_data': confirmCall}]
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
  return [
    [{"text": `➖Списание материалов`, 'callback_data': `Меню Списание`}],
    [{"text": `➕Добавление материалов`, 'callback_data': `Меню Добавление`}],
    [{"text": `💲Регистрация деталей`, 'callback_data': `Меню Регистрация`}],
  ]
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
  setValuesUnderLastRow(null, 'СКЛАД', 4, data)
}

function setValuesUnderLastRow(ssId=null, sheetName, column, twoDimensionalArray){
  addCurrentFuncToTrace()
  const customSs = ssId ? SpreadsheetApp.openById(ssId) : null
  const sheet = (ssId ? customSs : ss).getSheetByName(sheetName)
  const curRange = sheet.getRange(sheet.getMaxRows(), column)
  const row = curRange.getNextDataCell(SpreadsheetApp.Direction.UP).getLastRow() + 1
  const col = curRange.getLastColumn()
  const numRows = twoDimensionalArray.length
  const numCols = Math.max(twoDimensionalArray.map(row => row.length))
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
  const [messageId, textOld, keyboardOld] = Object.values(user.menuMessage)
  const isKbIdentical = JSON.stringify(keyboardOld) === JSON.stringify(keyboardNew)
  if (isKbIdentical && (textOld === textNew || !textNew)) return
  editMessage(user.id, messageId, textNew || textOld, keyboardNew)
  storeMenuMessage(messageId, textNew || textOld, keyboardNew)
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
  }
  saveUser()
  if (user.message) deleteLastMessage()
  showRegistrationMenu()
}

function applyRegistration() {
  addCurrentFuncToTrace()
  const uR = user.reg
  const date = toDate(user.callback_query.message.date)
  tableRegistrationAppend(date, user.id, uR.workType, uR.work,  uR.orderNum,  uR.detailNum, uR.quantity)
  const text = user.menuMessage.text.replace('Для регистрации деталей заполни форму',
                                             '👌 Зарегистрировано')
  user.reg = {}
  user.menuSection = null
  saveUser()
  editMenuMessage(text)
  greetUser()
}

function tableRegistrationAppend(){
  addCurrentFuncToTrace()
  const data = [[].slice.call(arguments)]
  setValuesUnderLastRow(ssIdColSdelkaDetWorks, 'ЖУРНАЛ РАБОТ', 2, data)
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
  if (user.menuSection === 'WriteOffMenu') selectMatWriteOff()
  if (user.menuSection === 'AddMenu') selectMatAddition()
  deleteLastMessage()
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
  user.messages.push(messageId || user.message.message_id)
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
  if (user.menuSection === 'WriteOffMenu') selectNumWriteOff()
  if (user.menuSection === 'AddMenu') updateTrioMenu()
  deleteLastMessage()
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
  if (user.menuSection === 'WriteOffMenu') confirmWriteOff()
  if (user.menuSection === 'AddMenu') confirmAddition()
  deleteLastMessage()
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
  const sheet = ss.getSheetByName('ЖУРНАЛ_ИСХОДНИК')
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
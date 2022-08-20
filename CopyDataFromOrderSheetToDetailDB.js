let event
const triggerColumnName = 'S'
const ss = SpreadsheetApp.getActiveSpreadsheet()
let orderName
const DEBUG = 0
let startTime
const rowQuantity = 60

function CopyDataFromOrderSheetToDetailDB(e) {
  startTime = now()
  event = e
  if (DEBUG) {doJob(); return}
  try {doJob()}
  catch (err) {showToast(err, '❌ Ошибка', -1)}
}

function now(date=0){
  if(!date) date = new Date()
  let y = date.getFullYear()
  let m = date.getMonth() + 1
  let d = date.getDate()
  let hh = date.getHours()
  let mm = date.getMinutes()
  let ss = date.getSeconds()
  return `${y}.${m}.${d} ${hh}:${mm}:${ss}`
}

function doJob() {
  if (!checkTrigger()) return
  orderName = getOrderName()
  notifyProgress('⏳ Операция начата')
  const [rowNum, rawCellAddresses] = getCellAddresses()
  const addressRanges = uniteCellAddressesToRanges(rawCellAddresses)
  const values = copyData(addressRanges)
  pasteData(rowNum, values)
  notifyProgress('✔ Готово')
}

function checkTrigger() {
  const isValidAddress = event.range.getA1Notation().startsWith(triggerColumnName)
                      && event.range.getLastRow() > 14
  if (!isValidAddress) return false

  const isNotSingleCell = event.range.getA1Notation().includes(':')
  if (isNotSingleCell) {
    showToast('Диапазон не поддерживается, включите один чекбокс', '❕ Предупреждение')
    return false
  }

  const isCheckboxDisabled = event.value !== 'TRUE'
  if (isCheckboxDisabled) {
    // showToast('Для Формирования листа заказа включите чекбокс', '❕ Предупреждение')
    return false
  }

  return true
}

function getOrderName() {
  const orderNameColumnName = 'H'
  const orderNameCellAddress = event.range.getA1Notation()
      .replace(triggerColumnName, orderNameColumnName)
  return SpreadsheetApp.getActive().getRange(orderNameCellAddress).getValue()
}

function notifyProgress(title) {
  const message = `Копирование данных с листа заказа ${orderName} в базу деталей`
  showToast(message, title)
}

function getCellAddresses() {
  counter = 0
  for (const row of getTableAddressDb()){
    counter ++
    const columnQuantityBeforeActualData = 3
    if (row[0] === orderName) {
      return [counter, row.slice(columnQuantityBeforeActualData)]
    }
  }
}

function getTableAddressDb() {
  const sheet = ss.getSheetByName('БАЗА АДРЕСОВ')
  const startColNum = 5
  const range = sheet.getRange(1, startColNum, sheet.getMaxRows(),
                               sheet.getMaxColumns() - (startColNum - 1))
  return range.getValues()
}

function uniteCellAddressesToRanges(addresses) {
  const ranges = []
  for (const i of range_(addresses.length / rowQuantity)) {
    const address = addresses[i * rowQuantity]
    if (!address){
      ranges.push(null)
      continue
    }
    const columnLetter = (address.match(/\D/g,'') + '').replace(',','')
    const rowNumber = Number(address.replace(columnLetter, '')) + rowQuantity - 1
    const rangeName = `${address}:${columnLetter}${rowNumber}`  // A1:A61
    ranges.push(rangeName)
  }
  return ranges
}

function range_(n) {
    return [...Array(n).keys()]
}

function copyData(addressRangesWithGaps) {
  const orderSheet = ss.getSheetByName(orderName)
  const ranges = orderSheet.getRangeList(addressRangesWithGaps.filter(r => r)).getRanges()
  let values = []
  for (const range of ranges) values = values.concat(...range.getValues())
  const empty = range_(rowQuantity).fill('')
  for (const i of range_(addressRangesWithGaps.length)) {
    if (addressRangesWithGaps[i]) continue
    values.splice(i * rowQuantity, 0, ...empty);
  }
  return values
}

function pasteData(rowNum, values) {
  const twoDimensionalArray = [values]
  let notes = values.map(v => '')
  notes[0] = `${startTime} Start\n${now()} End`
  ss.getSheetByName('БАЗА ИЗДЕЛИЙ')
    .getRange(rowNum, 8, 1, values.length)
    .setValues(twoDimensionalArray)
    .setNotes([notes])
}

function showToast(text, title=null, time=5) {
  SpreadsheetApp.getActive().toast(text, title, time)
}

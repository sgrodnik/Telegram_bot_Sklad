// main script: https://script.google.com/home/projects/1pxnFmYA4CLE91oEeTJvFRybp1Ec6q4sZE8A2Brd96prYyBbbr6Qx9uDc/edit

const token = HiPlan_ColoritSkladBot_script.token
const base = 'https://api.telegram.org/bot' + token + '/'

function doPost(e){
  HiPlan_ColoritSkladBot_script.doPost(e)
}

function setWebhook() {
  let thisAppId = ''
  let webAppUrl = 'https://script.google.com/macros/s/' + thisAppId + '/exec'
  let response = UrlFetchApp.fetch(base + 'setWebhook?url=' + webAppUrl)
  console.log(response.getContentText())
}
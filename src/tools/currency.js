export function currencyToSymbol(currency) {
  switch (currency) {
    case "GBP":
      return "£";
      break;
    case "USD":
      return "$";
      break;
    case "EUR":
      return "€";
      break;
    case "JPY":
      return "¥";
    case "RUB":
      return "₽";
    case "BTC":
      return "₿";
    default:
      return "§";
  }
}

export function moneyFormat(money) {
  money = money.toString();
  var len = money.length;
  if (money == "0") {
    return money;
  } else if (len < 2) {
    return "0.0" + money;
  } else if (len < 3) {
    return "0." + money;
  } else {
    return money.substring(0, len - 2) + "." + money.substring(len - 2);
  }
}

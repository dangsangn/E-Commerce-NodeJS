export class ServiceLogistic {
  transportClass: any
  getTransport = (customerInfo: Object) => {
    return new this.transportClass(customerInfo)
  }
}

class Car {
  name?: string
  price?: number
  customerInfo?: Object

  constructor({ name = 'Car', price = 1000, customerInfo = {} }) {
    this.name = name
    this.price = price
    this.customerInfo = customerInfo
  }
}

class Truck {
  name?: string
  price?: number
  customerInfo?: Object

  constructor({ name = 'Truck ', price = 10000, customerInfo = {} }) {
    this.name = name
    this.price = price
    this.customerInfo = customerInfo
  }
}

class CarServiceLogistic extends ServiceLogistic {
  transportClass = Car
}

class TruckServiceLogistic extends ServiceLogistic {
  transportClass = Truck
}

const carServiceLogistic = new CarServiceLogistic()
const truckServiceLogistic = new TruckServiceLogistic()
console.log(
  '🚀 ~ carServiceLogistic:',
  carServiceLogistic.getTransport({
    customerInfo: {
      name: 'Sang 1',
    },
  })
)
console.log(
  '🚀 ~ truckServiceLogistic:',
  truckServiceLogistic.getTransport({
    customerInfo: {
      name: 'Sang 2',
    },
  })
)

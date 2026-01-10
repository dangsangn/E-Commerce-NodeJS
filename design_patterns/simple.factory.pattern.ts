// level 0 by function

function getTransport(cargoVolume: number) {
  switch (cargoVolume) {
    case 10:
      return {
        name: 'Truck 10',
        price: 1000,
      }

    case 20:
      return {
        name: 'Truck 20',
        price: 2000,
      }

    case 50:
      return {
        name: 'Truck 50',
        price: 5000,
      }

    default:
      return {
        name: 'Truck 10',
        price: 1000,
      }
  }
}

console.log('Level 0: ', getTransport(10).name)

// Simple Factory Pattern
export class ServiceLogistic {
  name: string
  price: number

  constructor(name: string = 'Truck 10', price: number = 1000) {
    this.name = name
    this.price = price
  }

  static getTransport = (cargoVolume: number) => {
    switch (cargoVolume) {
      case 10:
        return new ServiceLogistic()

      case 20:
        return new ServiceLogistic('Truck 20', 2000)

      case 50:
        return new ServiceLogistic('Truck 50', 5000)

      default:
        return new ServiceLogistic('Truck 10', 1000)
    }
  }
}

console.log('Level 1: ', ServiceLogistic.getTransport(10).name)

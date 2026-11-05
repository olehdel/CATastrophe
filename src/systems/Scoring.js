export class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.total = 0;
    this.bonusTotal = 0;
  }

  award(points) {
    const amount = Math.max(0, Math.floor(points));
    this.total += amount;
    return amount;
  }

  awardBonus(points) {
    const amount = Math.max(0, Math.floor(points));
    this.total += amount;
    this.bonusTotal += amount;
    return amount;
  }
}

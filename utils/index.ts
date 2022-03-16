import { utils, BigNumber, constants } from "ethers";

export class Interface {
  static getInterfaceID(contractInterface: utils.Interface) {
    let interfaceID: BigNumber = constants.Zero;
    const functions: string[] = Object.keys(contractInterface.functions);
    for (let i=0; i< functions.length; i++) {
        interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
    }
  
    return interfaceID;
  }
}
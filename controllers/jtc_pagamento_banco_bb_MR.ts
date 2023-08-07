/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

import {EntryPoints} from 'N/types'
import * as MSR from '../models/jtc_pagmento_banco_bb_mr_MSR'
import * as log from 'N/log'

export const getInputData: EntryPoints.MapReduce.getInputData = () => {
    try {
        return MSR.getInputData()
    } catch (e) {
        log.error('jtc_pagamento_banco_bb_MR.getInputData', e)
    }
}

export const map: EntryPoints.MapReduce.map = (ctx: EntryPoints.MapReduce.mapContext) => {
    try {
        MSR.map(ctx)
    } catch (e) {
        log.error('jtc_pagamento_banco_bb_MR.map', e)
    }
}
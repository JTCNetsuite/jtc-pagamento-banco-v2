/**
 * @NApiVersion 2.1
 * @NModuleScope public
 */



import {EntryPoints} from 'N/types'
import * as log from 'N/log'
import * as search from 'N/search'
import {constante as CTS} from '../module/jtc_pagamento_banco_bb_CTS'
import * as https from 'N/https'
import * as record from 'N/record'


export const getInputData = () => {
    try {

        const response = []

        const invoiceRecord = search.create({
            type: search.Type.INVOICE,
            filters: [
                [CTS.INVOICE.STATUS, search.Operator.IS, 2], 
                "AND",
                ["mainline", search.Operator.IS, "T"],
                "AND", 
                ["custbody_jtc_created_bill","is","T"], 
                "AND", 
                ["terms","noneof","48","49"]
                // "AND",
                // ["internalid", search.Operator.ANYOF, 20259]
            ],
            columns: [
                search.createColumn({name: CTS.INVOICE.INTERNALID})
            ]
        }).run().each(res => {
            // log.debug('res', res);
            const results = JSON.parse(JSON.stringify(res));
            const idInvoice = String(res.getValue({name:CTS.INVOICE.INTERNALID}));
            // log.debug('idIvoice', idInvoice);

            const cnabInstallSearch = search.create({
                type: CTS.PARCELA_CNAB.ID,
                filters: [CTS.PARCELA_CNAB.TRANSACTION, search.Operator.ANYOF, idInvoice],
                columns: [
                    search.createColumn({
                        name: CTS.PARCELA_CNAB.NOSSO_NUMERO
                    })
                ]
            }).run().getRange({start:0, end:100});

            const invoiceObject = {};
            invoiceObject[idInvoice] = [];


            for (var i=0; cnabInstallSearch.length > i; i++ ) {
                const parcela = cnabInstallSearch[i].getValue({name: CTS.PARCELA_CNAB.NOSSO_NUMERO})
                invoiceObject[idInvoice].push(parcela);
                
            }
            response.push(invoiceObject);

             return true
        })
        log.debug("response;", response)

        return response

    } catch (e) {
        log.error('jtc_pagamento_banco_bb_mr_MSR.getInputData', e)
    }
}

export const map = (ctx: EntryPoints.MapReduce.mapContext) => {
    try {
        // log.debug("ctx", ctx.value)
        const data = getIntergrcaoBB()
        const token = getAccessToken(data.url_token, data.authorization)

        log.debug("token", token)

        const result = JSON.parse(ctx.value)
        
        var idInvoice
        var nossNumeros

        for (var i in result) {
            // log.debug(i, result[i])
            if (typeof(result[i]) != undefined) {
                idInvoice = i
                nossNumeros = result[i]
            }
        }

        log.debug(idInvoice, nossNumeros)

        

        if (nossNumeros.length > 0) {
            const filters = []

            for (var j =0; j < nossNumeros.length; j++){
                filters.push([CTS.PARCELA_CNAB.NOSSO_NUMERO,search.Operator.HASKEYWORDS, nossNumeros[j]], "OR");
            }
            filters.pop();
            // filters.push("AND", [CTS.PARCELA_CNAB.BOLETO_PAGO, search.Operator.IS, "F"])

            log.debug("filters", filters)
            

            const searchParcelaCnab = search.create({
                type: CTS.PARCELA_CNAB.ID,
                filters: [
                    [filters],
                    "AND",
                    [CTS.PARCELA_CNAB.BOLETO_PAGO, search.Operator.IS, "F"]
                ],
                columns: [
                    search.createColumn({name: CTS.PARCELA_CNAB.NUM_CONVENIO}),
                    search.createColumn({name: CTS.PARCELA_CNAB.NOSSO_NUMERO})
                ]
            }).run().each(res=> {
                // log.debug('res', res)
                
                const custumerPaymentRecord = record.transform({
                    fromType: record.Type.INVOICE,
                    fromId: idInvoice,
                    toType: record.Type.CUSTOMER_PAYMENT
                })

                const numConverio = res.getValue({name: CTS.PARCELA_CNAB.NUM_CONVENIO})
                const nossnum = res.getValue({name: CTS.PARCELA_CNAB.NOSSO_NUMERO})
                
                const urlBoletoIndividual = `https://api.bb.com.br/cobrancas/v2/boletos/${nossnum}?gw-dev-app-key=${data.key}&numeroConvenio=${numConverio}`

                log.debug('urlBoletoIndividual', urlBoletoIndividual)
                const authObj = token.body.token_type + " " + token.body.access_token

                const headerArr = {};
                headerArr['Authorization'] = authObj;
                headerArr['Accept'] = 'application/json';

                const responseBoletoIndivudual = JSON.parse(https.get({
                    url: urlBoletoIndividual,
                    headers: headerArr
                }).body)

                
                const tituloCobranca = responseBoletoIndivudual.codigoEstadoTituloCobranca

                let setou = false
                
                if (tituloCobranca == 6) {
                    log.audit("responseBoletoIndivudual", responseBoletoIndivudual)
                    const dt_pagamento_bb = String(responseBoletoIndivudual.dataCreditoLiquidacao).split(".")

                    const valor_pagamento_bb = responseBoletoIndivudual.valorPagoSacado
                    const dt_vencimento_bb = responseBoletoIndivudual.dataVencimentoTituloCobranca


                    const lineCount = custumerPaymentRecord.getLineCount(CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID)

                    custumerPaymentRecord.setValue({
                        fieldId: CTS.CUSTOMER_PAYMENT.CONTA_BANCARIA,
                        value: 620
                    })

                    const valor_orginal_pagamento = responseBoletoIndivudual.valorOriginalTituloCobranca

                    if (valor_orginal_pagamento != valor_pagamento_bb) {

                        custumerPaymentRecord.setValue({
                            fieldId: CTS.CUSTOMER_PAYMENT.DIFENCA_PAGO,
                            value: valor_pagamento_bb - valor_orginal_pagamento
                        })
                    }
                    custumerPaymentRecord.setValue({
                        fieldId: CTS.CUSTOMER_PAYMENT.TRANDATE,
                        value: new Date(`${dt_pagamento_bb[1]}/${dt_pagamento_bb[0]}/${dt_pagamento_bb[2]}`)
                    });


                    for (var l=0; l < lineCount; l++) {
                        
                        const data_vencimento_netsuite = custumerPaymentRecord.getSublistValue({
                            sublistId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID,
                            fieldId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.FIELDS.DATA_VENCIMENTO,
                            line: l
                        })
                        const invoiceIdLine = custumerPaymentRecord.getSublistValue({
                            sublistId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID,
                            fieldId: 'doc',
                            line: l
                        })
                        custumerPaymentRecord.setSublistValue({
                            fieldId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.FIELDS.APPLY,
                            sublistId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID,
                            line: l,
                            value: false
                        })

                        const dt_venc_formated_nt = formartDate(data_vencimento_netsuite)


                        if (dt_vencimento_bb == dt_venc_formated_nt && invoiceIdLine == idInvoice) {
                            // log.audit("data Vencimento Netsuite", dt_venc_formated_nt)

                            // log.audit("data Vencimento BB", dt_vencimento_bb)
                            const apply = custumerPaymentRecord.getSublistValue({
                                fieldId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.FIELDS.APPLY,
                                sublistId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID,
                                line: l
                            })
                         
                            custumerPaymentRecord.setSublistValue({
                                fieldId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.FIELDS.APPLY,
                                sublistId: CTS.CUSTOMER_PAYMENT.SUBLIST_INSTALL.ID,
                                line: l,
                                value: true
                            })
                            
                            log.audit(dt_venc_formated_nt, dt_vencimento_bb)
                            
                        }

                    }
                    
                    const idCustomerPayment = custumerPaymentRecord.save({ignoreMandatoryFields: true})
                    log.audit("idCustomerPayment", idCustomerPayment)
                    
                    if (idCustomerPayment) {
                        const parcelanCnabRecord = record.load({
                            type: CTS.PARCELA_CNAB.ID,
                            id: res.id
                        })

                        parcelanCnabRecord.setValue({fieldId: CTS.PARCELA_CNAB.BOLETO_PAGO, value: true})

                        const idSaveParcelaCnab = parcelanCnabRecord.save({ignoreMandatoryFields: true})
                        log.audit("idSaveParcelaCnab", idSaveParcelaCnab)
                    }
                }  
                
                return true
            })
        }
       

    } catch (e) {
        log.error('jtc_pagamento_banco_bb_mr_MSR.map', e)
    }
}

const getAccessToken = (url_token, authorization) => {
    try {
        
        const urlObj = String(url_token);

        const bodyObj = {
                "grant_type": "client_credentials",
                "scope": "cobrancas.boletos-info cobrancas.boletos-requisicao"
        };

        const authObj = authorization; //* alterado basic pelo de produção;

        const headerArr = {};
        headerArr['Authorization'] = authObj;
        headerArr['Accept'] = 'application/json';

        const response = https.post({
                url: urlObj,
                body: bodyObj,
                headers: headerArr
        });


        return {
            body: JSON.parse(response.body),
        };

    } catch (e) {
            log.error('getAccessToken',e);
    }
}

const getIntergrcaoBB = () => {
    try{
        const searchIntegracaoBB = search.create({
            type: CTS.INTEGRACAO_BB.ID,
            filters: [],
            columns: [
                search.createColumn({name: CTS.INTEGRACAO_BB.KEY}),
                search.createColumn({name: CTS.INTEGRACAO_BB.URL_TOKEN}),
                search.createColumn({name: CTS.INTEGRACAO_BB.AUTHORIZATION}),
                search.createColumn({name: CTS.INTEGRACAO_BB.CONTA}),
                search.createColumn({name: CTS.INTEGRACAO_BB.AGENCIA})
            ]
        }).run().getRange({start: 0, end: 1});

        if (searchIntegracaoBB.length > 0) {
            return {
                'key': searchIntegracaoBB[0].getValue({name: CTS.INTEGRACAO_BB.KEY}),
                'url_token': searchIntegracaoBB[0].getValue({name: CTS.INTEGRACAO_BB.URL_TOKEN}),
                'authorization': searchIntegracaoBB[0].getValue({name: CTS.INTEGRACAO_BB.AUTHORIZATION}),
            };
        } else {
            throw {
                'msg': 'cadastrar RT INTEGRACAO BB'
            };
        }
    } catch (e) {
        log.error('getIntergrcaoBB',e);
        throw e
    }

}


const formartDate = (dateInfo) => {
    const date = new Date(dateInfo);
    var day: string | number = date.getDate();
    var month: string | number = date.getMonth() + 1;
    const year = date.getFullYear();

    if (day < 10)
        day = '0'+day;
    if (month < 10) {
        month = '0'+month;
    }

    return ""+day+"."+month+"."+year;

}
/**
 * @NApiVersion 2.1
 * @NModuleScope public
 */


export const constante = {
    INTEGRACAO_BB:{
        ID: 'customrecord_jtc_rt_integracao_bb',
        KEY: 'custrecord_jtc_int_bb_key',
        URL_TOKEN: 'custrecord_jtc_int_bb_url_token',
        AUTHORIZATION: 'custrecord_jtc_int_bb_authorization',
        CONTA: 'custrecord_jtc_int_bb_conta',
        AGENCIA: 'custrecord_jtc_int_bb_agencia'
    },

    PARCELA_CNAB: {
        ID: 'customrecord_dk_cnab_aux_parcela',
        TRANSACTION: 'custrecord_dk_cnab_transacao',
        NOSSO_NUMERO: 'custrecord_dk_cnab_nosso_numero',
        DATA_VENCIMENTO: 'custrecord_dk_cnab_dt_vencimento',
        PAGAMENTO: 'custrecord_dk_cnab_transacao_pg',
        BOLETO_PAGO: 'custrecord_jtc_int_boleto_pago',
        NUM_CONVENIO: 'custrecord_dk_cnab_numero_convenio'
    },
    INVOICE: {
        ID: 'invoice',
        INTERNALID: 'internalid',
        STATUS: 'approvalstatus'
    },
    CUSTOMER_PAYMENT: {
        ID: 'customerpayment',
        CONTA_BANCARIA: "custbody_jtc_cont_banc_inter",
        TRANDATE: 'trandate',
        DIFENCA_PAGO: 'custbody_jtc_int_dif_valor_org_pago',
        SUBLIST_INSTALL: {
            ID: 'apply',
            FIELDS: {
                REFNUM: 'refnum',
                APPLY: 'apply',
                DATA_VENCIMENTO: 'applyduedate'
            }
        }
    }
}
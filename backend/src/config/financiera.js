// Configuración financiera centralizada
// Todos los umbrales y valores por defecto del sistema abaco

module.exports = {
  // IDs por defecto
  default_empresa_id: parseInt(process.env.DEFAULT_EMPRESA_ID) || 1,
  default_usuario_id: parseInt(process.env.DEFAULT_USUARIO_ID) || 1,
  
  // Moneda por defecto
  moneda_default: process.env.MONEDA_DEFAULT || 'GTQ',
  
  // Timezone
  timezone: process.env.TZ || 'America/Guatemala',
  
  // Umbrales de liquidez
  liquidez: {
    critico: parseFloat(process.env.UMBRAL_LIQUIDEZ_CRITICO) || 100000,
    advertencia: parseFloat(process.env.UMBRAL_LIQUIDEZ_ADVERTENCIA) || 500000,
    dias_operacion_default: parseFloat(process.env.GASTO_DIARIO_DEFAULT) || 50000
  },
  
  // Umbrales de CxC
  cxc: {
    critico_vencido: parseFloat(process.env.UMBRAL_CXC_CRITICO) || 500000,
    advertencia_vencido: parseFloat(process.env.UMBRAL_CXC_ADVERTENCIA) || 100000,
    dias_atraso_critico: parseInt(process.env.CXC_DIAS_ATRASO_CRITICO) || 60,
    dias_atraso_advertencia: parseInt(process.env.CXC_DIAS_ATRASO_ADVERTENCIA) || 30
  },
  
  // Umbrales de CxP
  cxp: {
    proximo_vencimiento_dias: parseInt(process.env.CXP_PROXIMO_VENCIMIENTO_DIAS) || 7,
    monto_proximo_critico: parseFloat(process.env.CXP_MONTO_CRITICO) || 100000
  },
  
  // Working capital
  workingCapital: {
    efectivo_retenido_factor: parseFloat(process.env.WC_EFECTIVO_RETENIDO_FACTOR) || 100000,
    dias_extension_default: parseInt(process.env.WC_DIAS_EXTENSION) || 30,
    monto_vencido_critico: parseFloat(process.env.WC_CXP_VENCIDO_CRITICO) || 100000
  },
  
  // Concentración de clientes
  concentracion: {
    umbral_critico: parseFloat(process.env.CONCENTRACION_CLIENTE_CRITICO) || 0.20, // 20%
    umbral_advertencia: parseFloat(process.env.CONCENTRACION_CLIENTE_ADVERTENCIA) || 0.15 // 15%
  },
  
  // SAT / Cumplimiento
  sat: {
    dias_alerta_iva: parseInt(process.env.SAT_DIAS_ALERTA_IVA) || 15,
    dias_alerta_isr: parseInt(process.env.SAT_DIAS_ALERTA_ISR) || 15
  }
};

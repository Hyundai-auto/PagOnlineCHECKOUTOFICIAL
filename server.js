require('dotenv').config(); // Esta linha lê o arquivo .env
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// O código agora busca a chave automaticamente do arquivo .env
const PAYEVO_API_URL = 'https://apiv2.payevo.com.br/functions/v1/transactions';
const PAYEVO_SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

app.use(cors( ));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ...
app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const paymentData = req.body;
    try {
        // CORREÇÃO: Utilizar o objeto 'auth' do axios para autenticação Basic
        const response = await axios.post(PAYEVO_API_URL, paymentData, {
            auth: {
                username: PAYEVO_SECRET_KEY,
                password: '' // A senha deve ser uma string vazia
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Erro ao processar pagamento na PayEvo:', error.response ? error.response.data : error.message);
        if (error.response) {
            res.status(error.response.status).json({
                message: 'Erro na comunicação com o gateway de pagamento.',
                details: error.response.data
            });
        } else {
            res.status(500).json({ message: 'Erro interno no servidor.' });
        }
    }
});
// ...


app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));

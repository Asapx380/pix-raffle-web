# 🎟️ Sorteio Kit Natura — IBPM

Aplicação web para gerenciamento de um sorteio (rifa) de um Kit Natura Ilía, criada voluntariamente para a Igreja Batista Palavra e Missão (IBPM).

🔗 **Acesse:** [sorteio-kit-natura-ibpm.netlify.app](https://sorteio-kit-natura-ibpm.netlify.app)

## ✨ Funcionalidades

- Login por telefone para clientes e área administrativa
- Grade interativa de números disponíveis, reservados e pagos
- Geração de cobrança via **Pix** (QR Code + copia e cola)
- Sincronização em tempo real com **Firebase Realtime Database**
- Automação de confirmação de pagamento via **Make.com**
- Comprovante de compra gerado como imagem (html2canvas)
- Exportação de dados em CSV e backup em JSON
- Contagem regressiva para expiração automática de reservas

## 🛠️ Tecnologias

- HTML5, CSS3 e JavaScript puro (sem frameworks)
- [Firebase Realtime Database](https://firebase.google.com/)
- [Make.com](https://www.make.com/) para automações
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) para geração de QR Code Pix
- [html2canvas](https://html2canvas.hertzen.com/) para gerar o comprovante em imagem

## 📁 Estrutura do projeto

```
├── index.html          # Estrutura da página
├── assets/
│   ├── css/
│   │   └── style.css   # Estilos da aplicação
│   ├── js/
│   │   └── app.js      # Lógica da aplicação (login, Pix, Firebase, admin...)
│   └── img/             # Imagens e logo
├── .gitignore
└── README.md
```

## ⚙️ Configuração

O projeto usa o Firebase Realtime Database para persistir os dados do sorteio. As credenciais do projeto Firebase ficam no início do arquivo `assets/js/app.js`, na constante `FIREBASE_CONFIG`.

> ℹ️ Chaves de Firebase (`apiKey`) não são secretas por natureza — a segurança real do banco depende das **regras de acesso (Security Rules)** configuradas no console do Firebase, não em escondê-las no código.

## 📌 Status

Projeto ativo, mantido de forma voluntária para a IBPM.

## 👤 Autor

Desenvolvido por [Wesley](https://github.com/Asapx380) — Desenvolvedor Front-End em Formação Full Stack.

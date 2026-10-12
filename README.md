# Sistema de Arrecadação com Integração Pix em Tempo Real

Aplicação web para gerenciamento de sorteio (rifa) beneficente, desenvolvida voluntariamente para a Igreja Batista Pentecostal Mundial (IBPM).

[Acesse a versão ao vivo do projeto](https://sorteio-kit-natura-ibpm.netlify.app/)

---

## Funcionalidades

- Login por telefone para clientes e painel administrativo.
- Grade interativa de números disponíveis, reservados e pagos.
- Geração de cobrança via Pix (QR Code e copia-e-cola).
- Sincronização em tempo real com Firebase Realtime Database.
- Automação de confirmação de pagamento via Make.com.
- Comprovante de compra gerado em formato de imagem (html2canvas).
- Exportação de dados em CSV e backup em JSON.
- Contagem regressiva para expiração automática de reservas pendentes.

---

## Tecnologias Utilizadas

- HTML5, CSS3 e JavaScript puro (sem frameworks)
- [Firebase Realtime Database](https://firebase.google.com/) para persistência em tempo real
- [Make.com](https://www.make.com/) para automações de pagamento via webhooks
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) para geração de QR Code Pix
- [html2canvas](https://html2canvas.hertzen.com/) para renderização de comprovantes em imagem

---

## Estrutura do Projeto

```text
.
├── index.html              # Estrutura principal da página
├── assets/
│   ├── css/
│   │   └── style.css       # Estilos da aplicação
│   ├── js/
│   │   └── app.js          # Lógica principal (login, Pix, Firebase, admin)
│   └── img/                # Imagens e recursos visuais
├── .gitignore
└── README.md
```

---

## Configuração e Segurança

O projeto utiliza o **Firebase Realtime Database** para armazenar e sincronizar os dados.

As credenciais públicas do projeto ficam localizadas no arquivo `assets/js/app.js`, na constante `FIREBASE_CONFIG`.

> Nota sobre segurança: As chaves de API do Firebase (`apiKey`) são públicas por design no desenvolvimento front-end. A segurança dos dados é assegurada pelas Regras de Acesso (*Security Rules*) configuradas no console do Firebase.

---

## Status do Projeto

Projeto ativo, mantido voluntariamente para a IBPM.

---

## Desenvolvimento e validação

Este projeto é estático. Para servir a pasta localmente, com Python instalado:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080/`. Para conferir a sintaxe, com Node.js instalado:

```bash
node --check assets/js/app.js
```

Em um ambiente de teste, confira seleção, atualização de disponibilidade, expiração de reservas e exportação. Valide as regras do Firebase e a autorização do administrador no servidor. Não use dados ou cobranças reais para testar.

A verificação de sintaxe não substitui os testes da interface e das integrações.

## Integrações e ambiente de teste

O login por telefone e controles exibidos no navegador não substituem autorização no backend. As regras do Firebase e os fluxos do Make.com ficam fora deste repositório e devem validar permissões, pagamentos e alterações de estado. Configure serviços separados para desenvolvimento antes de executar operações de reserva ou pagamento.

Não versione segredos, backups com dados pessoais ou URLs de webhook que concedam acesso às automações.

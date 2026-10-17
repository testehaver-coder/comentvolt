/* chatmany UI translations. The UI is written in English; when another language is active this
   translates whatever the page shows: every text node and placeholder/title/aria-label, looked up
   by its exact English text (or a pattern, for text with numbers or names in it). A
   MutationObserver applies it to everything rendered later, so app.js keeps plain English
   templates. The Instagram phone preview (.iphone) is never translated automatically: it must
   show exactly the messages followers will receive (app.js translates its Instagram labels). English is the fallback for anything not listed here. */
(function () {
  const PT = {
    "+ New automation": "+ Nova automação",
    "+ insert link {reward}": "+ inserir link {reward}",
    "A post with its own automation keeps using that one; this covers all the others. Without webhooks, your 5 most recent posts are checked.":
      "Um post com automação própria continua usando a dele; esta cobre todos os outros. Sem webhooks, são conferidos os seus 5 posts mais recentes.",
    "All": "Todas",
    "any word": "qualquer palavra",
    "Before going live:": "Antes de colocar no ar:",
    "Every comment starts the funnel (except the excluded words below).": "Todo comentário inicia o funil (menos as palavras excluídas abaixo).",
    "Every post on the account, including the next ones you publish.": "Todos os posts da conta, inclusive os próximos que você publicar.",
    "Folder name": "Nome da pasta",
    "Follow-up message": "Mensagem de lembrete",
    "Follow-ups sent": "Lembretes enviados",
    "Follow-ups start working once chatmany is online with a public https address — that is how it knows who opened the link.":
      "Os lembretes começam a funcionar quando o chatmany estiver na internet, com um endereço https público. É assim que ele sabe quem abriu o link.",
    "Goes only to people who tapped the button but never opened the link — Instagram allows it within 24 hours.":
      "Vai só para quem tocou no botão e não abriu o link. O Instagram permite isso dentro de 24 horas.",
    "Keywords": "Palavras-chave",
    "Link opens": "Abriram o link",
    "Love this! 😍": "Amei! 😍",
    "Now": "Agora",
    "Post": "Publicar",
    "Publication": "Publicação",
    "User": "Usuário",
    "View all comments": "Ver todos os comentários",
    "Move to folder…": "Mover para pasta…",
    "Moved to folder": "Movida para a pasta",
    "New folder…": "Nova pasta…",
    "No folder": "Sem pasta",
    "Press Enter after each word.": "Aperte Enter depois de cada palavra.",
    "Removed from folder": "Tirada da pasta",
    "Send it after": "Mandar depois de",
    "View as list": "Ver em lista",
    "Write the follow-up message in section 4.": "Escreva a mensagem de lembrete na seção 4.",
    "A specific post or reel": "Um post ou reel específico",
    "A specific word or words": "Uma ou mais palavras específicas",
    "Add at least one keyword in section 2.": "Adicione pelo menos uma palavra-chave na seção 2.",
    "Add your link or reward in section 4.": "Adicione seu link ou recompensa na seção 4.",
    "Active now": "Ativo agora",
    "All campaigns": "Todas as campanhas",
    "An opening DM": "Uma DM de abertura",
    "And then, they will get": "Depois, a pessoa recebe",
    "And this comment has": "E esse comentário tem",
    "Any post or reel": "Qualquer post ou reel",
    "Any trigger": "Qualquer gatilho",
    "Any trigger states": "Qualquer situação",
    "Any word": "Qualquer palavra",
    "Archive": "Arquivo",
    "Archived ▾": "Arquivadas ▾",
    "Ask for their email": "Pedir o e-mail",
    "Ask them to follow you first": "Pedir para seguir você antes",
    "Automation archived": "Automação arquivada",
    "Automation deleted": "Automação excluída",
    "Automation is live": "Automação no ar",
    "Automation permanently deleted": "Automação excluída de vez",
    "Automation restored": "Automação restaurada",
    "Automation stopped": "Automação pausada",
    "Automations": "Automações",
    "Automations need a connected Instagram Professional account — there's nothing for an automation to watch or send until one is linked.":
      "As automações precisam de uma conta profissional do Instagram conectada. Sem ela, não há nada para acompanhar nem enviar.",
    "Button label": "Texto do botão",
    "Campaign": "Campanha",
    "Cancel": "Cancelar",
    "Changes do not take effect until saved": "As mudanças só valem depois de salvar",
    "Clicked": "Clicaram",
    "Clicks": "Cliques",
    "Comment": "Comentário",
    "Commented": "Comentaram",
    "Comments": "Comentários",
    "comments": "comentários",
    "Connect Instagram": "Conectar Instagram",
    "Connect Instagram first": "Conecte o Instagram primeiro",
    "Connect Instagram in Postiz": "Conectar Instagram no Postiz",
    "Connect Instagram to load your posts. You can still edit the copy and preview below.":
      "Conecte o Instagram para carregar seus posts. Você ainda pode editar os textos e ver a prévia abaixo.",
    "Connect it in Postiz: Add Channel → Instagram (Standalone)": "Conecte no Postiz: Adicionar canal → Instagram (Standalone)",
    "Connect it once in Postiz (Add Channel → Instagram (Standalone)); it's used here automatically.":
      "Conecte uma vez no Postiz (Adicionar canal → Instagram (Standalone)) e ele é usado aqui automaticamente.",
    "Contacts": "Contatos",
    "Continue": "Continuar",
    "Conversion funnel": "Funil de conversão",
    "Couldn't sign you in": "Não foi possível entrar",
    "Create": "Criar",
    "Dashboard": "Painel",
    "Data deletion": "Exclusão de dados",
    "Delete": "Excluir",
    "Delivered": "Entregues",
    "Delivery message": "Mensagem de entrega",
    "Email ask message": "Mensagem pedindo o e-mail",
    "Emails": "E-mails",
    "Enter the owner token you set as the": "Digite o token de dono definido no segredo",
    "Every comment-to-DM funnel in this instance.": "Todos os funis de comentário para DM desta instalação.",
    "Everyone who entered a campaign.": "Todas as pessoas que entraram em uma campanha.",
    "Exclude words (optional)": "Palavras para excluir (opcional)",
    "Export CSV": "Exportar CSV",
    "Folders are coming soon": "Pastas chegam em breve",
    "Follow button label": "Texto do botão de seguir",
    "Follow message": "Mensagem para seguir",
    "Follow-up DM if they don’t click": "DM de lembrete se a pessoa não clicar",
    "Followed": "Seguiram",
    "Follows": "Seguiram",
    "Gave email": "Deram o e-mail",
    "Go live": "Colocar no ar",
    "Grid view is coming soon": "Visualização em grade chega em breve",
    "Instagram allows 20 characters on a button.": "O Instagram permite 20 caracteres em um botão.",
    "Keywords (comma separated)": "Palavras-chave (separadas por vírgula)",
    "Like their comment": "Curtir o comentário",
    "Link or reward": "Link ou recompensa",
    "Link, Guide": "Link, Guia",
    "Live": "No ar",
    "Loading…": "Carregando…",
    "Modified ▾": "Modificada ▾",
    "My automations": "Minhas automações",
    "Name ▾": "Nome ▾",
    "New automation…": "Nova automação…",
    "New folder": "Nova pasta",
    "No archived automations match your search.": "Nenhuma automação arquivada corresponde à busca.",
    "No automations match your search.": "Nenhuma automação corresponde à busca.",
    'No automations yet. Click "+ New automation" to build your first comment-to-DM funnel.':
      'Nenhuma automação ainda. Clique em "+ Nova automação" para criar seu primeiro funil de comentário para DM.',
    "No contacts yet. Once people comment your keyword, they’ll appear here.":
      "Nenhum contato ainda. Quando alguém comentar sua palavra-chave, a pessoa aparece aqui.",
    "No Instagram account connected yet.": "Nenhuma conta do Instagram conectada ainda.",
    "Not connected": "Não conectado",
    "Not possible — Instagram's API has no way to like a comment.": "Não é possível: a API do Instagram não permite curtir comentários.",
    "Nothing archived. Archive an automation from the Automations tab to keep it around without it running.":
      "Nada arquivado. Arquive uma automação na aba Automações para guardá-la sem que ela rode.",
    "Only comments on the selected media trigger the funnel.": "Só comentários na mídia selecionada iniciam o funil.",
    "Opening DM is off — the funnel won’t start.": "A DM de abertura está desligada, então o funil não começa.",
    "Opening DMs": "DMs de abertura",
    "Opening message": "Mensagem de abertura",
    "Owner sign in": "Entrada do dono",
    "Owner token": "Token de dono",
    "Percentages are relative to comments with the keyword.": "As porcentagens são em relação aos comentários com a palavra-chave.",
    "Performance from logged funnel events.": "Desempenho a partir dos eventos registrados do funil.",
    "Permanently delete this automation? This can't be undone.": "Excluir esta automação de vez? Isso não pode ser desfeito.",
    "Pick the post or reel this automation watches.": "Escolha o post ou reel que esta automação acompanha.",
    "Post a public reply under the comment (rotates to look human).":
      "Responde em público embaixo do comentário (alterna as respostas para parecer natural).",
    "Privacy": "Privacidade",
    "Public replies (one per line, rotated)": "Respostas públicas (uma por linha, alternadas)",
    "Range": "Período",
    "Reload this page in Postiz to sign in again. If it keeps happening, check that CHATMANY_SSO_SECRET in Postiz matches POSTIZ_SSO_SECRET in chatmany.":
      "Recarregue esta página no Postiz para entrar de novo. Se continuar, confira se CHATMANY_SSO_SECRET no Postiz é igual a POSTIZ_SSO_SECRET no chatmany.",
    "Reply to their comment": "Responder o comentário",
    "Restore": "Restaurar",
    "Runs": "Execuções",
    "Save": "Salvar",
    "Save changes •": "Salvar alterações •",
    "Saved": "Salvo",
    "Search all automations": "Buscar em todas as automações",
    "Search archived automations": "Buscar automações arquivadas",
    "secret.": "do chatmany.",
    "Select a post or reel in section 1.": "Selecione um post ou reel na seção 1.",
    "Self-attestation — the tap advances (the API can’t verify a specific follow).":
      "A pessoa confirma sozinha: o toque avança (a API não consegue confirmar quem segue).",
    "Sent as a private reply with a button so it survives the Requests folder. Required to start the funnel.":
      "Vai como resposta privada com botão, para não ficar presa em Solicitações. Obrigatória para iniciar o funil.",
    "Session token was rejected. Enter it again.": "O token foi recusado. Digite de novo.",
    "Soon": "Em breve",
    "Star on GitHub": "Estrela no GitHub",
    "Stop": "Pausar",
    "Stopped": "Pausada",
    "Stopped automations, kept out of the way but not deleted — restore any of them at any time.":
      "Automações pausadas, guardadas à parte sem excluir. Restaure qualquer uma quando quiser.",
    "The automation builder and its media picker need a connected Instagram Professional account — there's nothing for an automation to watch or send until one is linked.":
      "O criador de automações e o seletor de mídia precisam de uma conta profissional do Instagram conectada. Sem ela, não há nada para acompanhar nem enviar.",
    "The reward, delivered by DM. Use": "A recompensa, entregue por DM. Use",
    "They will get": "A pessoa recebe",
    "to place your link.": "para inserir seu link.",
    "Turn on the opening DM — it’s required to start the funnel.": "Ligue a DM de abertura: ela é obrigatória para iniciar o funil.",
    "User comments and comment contains": "A pessoa comenta e o comentário contém",
    "Uses Instagram’s email chip, with a typed-reply fallback.": "Usa o botão de e-mail do Instagram, ou a pessoa digita a resposta.",
    "View as grid": "Ver em grade",
    "When someone comments on": "Quando alguém comentar em",
    "Whole-word match, case-insensitive — “ai” fires on “I like this ai”, not “fair”.":
      "Palavra inteira, sem diferenciar maiúsculas: “ai” dispara em “gostei disso ai”, mas não em “caixa”.",
    "You'll approve access on Instagram's own page. chatmany never sees your password.":
      "Você autoriza o acesso na própria página do Instagram. O chatmany nunca vê sua senha.",
    "Your Instagram token expired — reconnect to resume.": "O acesso ao Instagram expirou. Reconecte para continuar.",
    "Your OWNER_TOKEN": "Seu OWNER_TOKEN",
    "archived": "arquivada",
    "awaiting email": "aguardando e-mail",
    "awaiting follow": "aguardando seguir",
    "delivered": "entregue",
    "delivering": "entregando",
    "follower": "seguidor",
    "just now": "agora mesmo",
    "leave": "sair",
    "leave this page": "sair desta página",
    "less": "menos",
    "likes": "curtidas",
    "live": "no ar",
    "Message...": "Mensagem...",
    "more": "mais",
    "now": "agora",
    "Reply": "Responder",
    "Show less": "Mostrar menos",
    "stopped": "pausada",
    "n/a": "n/d",
    "opening": "abrindo",
    "opening sent": "abertura enviada",
    "scam, fake": "golpe, falso",
    "self-hosted": "hospedado por você",
    "switch automations": "trocar de automação",
    "tap moves the chat out of Requests →": "o toque tira a conversa de Solicitações →",
    "these automations": "estas automações",
    "this automation": "esta automação",
    "your link": "seu link",
    "your@email.com": "seu@email.com",
    "✓ followed": "✓ seguiu",
    "Material delivery link": "Link de entrega do material",
    "Reminder button name": "Nome do botão do lembrete",
    "Follow-up DM if they don't click": "DM de lembrete se a pessoa não clicar",
    "Reminder message": "Mensagem de lembrete",
    "Delivery button": "Botão de entrega",
    "Automation features": "Funções da automação",
    "Turn each function on or off independently. All are enabled by default.": "Ligue ou desligue cada função independentemente. Todas estão ligadas por padrão.",
    "Comment Detection": "Detecção de comentários",
    "Monitor for keywords": "Monitorar palavras-chave",
    "Watch comments for your keywords": "Acompanhe comentários com suas palavras-chave",
    "Public Reply": "Resposta pública",
    "Reply publicly": "Responder em público",
    "Post reply under the comment with @mention": "Responda em público embaixo do comentário com @menção",
    "Private Message Flow": "Fluxo de mensagem privada",
    "Send opening DM": "Enviar DM de abertura",
    "Private reply with button (starts the funnel)": "Resposta privada com botão (inicia o funil)",
    "Opening button": "Botão de abertura",
    "Button in the opening message": "Botão na mensagem de abertura",
    "Follow Gate": "Portão de seguir",
    "Ask to follow": "Pedir para seguir",
    "Request user to follow before continuing": "Peça ao usuário para seguir antes de continuar",
    "Confirmation button": "Botão de confirmação",
    "Show 'Already following' button": "Mostrar botão 'Já estou seguindo'",
    "Verify via API": "Verificar via API",
    "Check if they really followed": "Verifique se realmente seguiram",
    "Retry if not confirmed": "Tentar novamente se não confirmado",
    "Resend message if follow not verified": "Reenvie a mensagem se o seguimento não for verificado",
    "Reward Delivery": "Entrega da recompensa",
    "Send the link": "Enviar o link",
    "Deliver final link/reward automatically": "Entregue o link/recompensa final automaticamente",
    "Track clicks": "Rastrear cliques",
    "Record when they open the link": "Registre quando abrem o link",
    "Reminder after 24h": "Lembrete depois de 24h",
    "Follow-up DM if link never opened": "DM de lembrete se o link nunca foi aberto",
    "Email Collection": "Coleta de e-mail",
    "Ask for email": "Pedir e-mail",
    "Request email via Instagram chip": "Peça e-mail via botão do Instagram",
    "Recommendation DM (suggest another product)": "DM de recomendação (sugerir outro produto)",
    "Goes to people who completed the funnel. Sent after a delay to suggest something else.": "Vai para quem completou o funil. Enviada com atraso para sugerir outra coisa.",
    "Recommendation message": "Mensagem de recomendação",
    "Recommendation button name": "Nome do botão de recomendação",
    "Recommendation link (optional)": "Link de recomendação (opcional)",
  };

  const plural = (n, one, many) => (n === "1" ? one : many);
  // Checked in order; `t` translates a captured English fragment (e.g. "this automation").
  const PT_PATTERNS = [
    [/^(\d+) minutes? ago$/, (m, n) => `há ${n} ${plural(n, "minuto", "minutos")}`],
    [/^(\d+) hours? ago$/, (m, n) => `há ${n} ${plural(n, "hora", "horas")}`],
    [/^(\d+) days? ago$/, (m, n) => `há ${n} ${plural(n, "dia", "dias")}`],
    [/^Last (\d+) days$/, (m, n) => `Últimos ${n} dias`],
    [/^(\d+) selected$/, (m, n) => `${n} ${plural(n, "selecionada", "selecionadas")}`],
    [/^(\d+) automations deleted$/, (m, n) => `${n} automações excluídas`],
    [/^these (\d+) automations$/, (m, n) => `estas ${n} automações`],
    [/^([\d.]+)% of DMs$/, (m, n) => `${n}% das DMs`],
    [/^See more \((\d+)\)$/, (m, n) => `Ver mais (${n})`],
    [/^Add a comment for ([\s\S]+)\.\.\.$/, (m, name) => `Adicione um comentário para ${name}...`],
    [/^New drop is live 🔥 comment "([\s\S]+)" and I'll send it\.$/, (m, kw) => `Lançamento no ar 🔥 comenta "${kw}" que eu te mando.`],
    [/^If they don't open the link, ([\s\S]+) later:$/, (m, delay) => `Se não abrir o link, ${delay} depois:`],
    [/^Export failed: ([\s\S]*)$/, (m, why) => `Falha ao exportar: ${why}`],
    [/^Delete "([\s\S]+)"\? This can't be undone\.$/, (m, name) => `Excluir "${name}"? Isso não pode ser desfeito.`],
    [/^Delete ([\s\S]+)\? This can't be undone\.$/, (m, what, t) => `Excluir ${t(what)}? Isso não pode ser desfeito.`],
    [
      /^You have unsaved changes to "([\s\S]+)"\.\n\nThey will NOT take effect until you save\. If you ([\s\S]+) now, the changes are lost\.\n\nOK to discard them, or Cancel to go back and save\.$/,
      (m, name, what, t) =>
        `Você tem alterações não salvas em "${t(name)}".\n\nElas NÃO valem até você salvar. Se você ${t(what)} agora, as alterações se perdem.\n\nOK para descartar, ou Cancelar para voltar e salvar.`,
    ],
  ];

  const DICTS = { pt: { exact: PT, patterns: PT_PATTERNS } };
  let lang = "pt";

  /** Translate one UI string, keeping its surrounding whitespace; unknown text is returned as is. */
  function t(text) {
    const dict = DICTS[lang];
    if (!dict || typeof text !== "string") return text;
    const core = text.trim();
    if (!core) return text;
    let out = dict.exact[core];
    if (out === undefined) {
      for (const [re, rep] of dict.patterns) {
        const m = core.match(re);
        if (m) {
          out = rep(...m, t);
          break;
        }
      }
    }
    return out === undefined ? text : text.replace(core, out);
  }

  /** "pt-BR" -> "pt"; anything without a dictionary falls back to English. */
  function pick(code) {
    const base = String(code || "").toLowerCase().split(/[-_]/)[0];
    return DICTS[base] ? base : "en";
  }

  const SKIP = "script,style,textarea,.iphone,[data-no-i18n]";
  const ATTRS = ["placeholder", "title", "aria-label"];

  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(SKIP)) return;
    const next = t(node.data);
    if (next !== node.data) node.data = next;
  }

  function translateElement(elem) {
    if (elem.closest(SKIP)) return;
    for (const a of ATTRS) {
      const v = elem.getAttribute(a);
      if (v) {
        const next = t(v);
        if (next !== v) elem.setAttribute(a, next);
      }
    }
  }

  function translateTree(root) {
    if (lang === "en" || !root) return;
    if (root.nodeType === 3) return translateText(root);
    if (root.nodeType !== 1) return;
    translateElement(root);
    root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(translateElement);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n);
  }

  let observer = null;
  function watch(root) {
    translateTree(root);
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") translateText(m.target);
        else m.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function setLanguage(code) {
    lang = pick(code);
    if (typeof document !== "undefined") document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    return lang;
  }

  window.chatmanyI18n = { t, pick, setLanguage, watch, language: () => lang };
})();

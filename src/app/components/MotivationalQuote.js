import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTIVATIONAL_QUOTES } from '../constants/motivationalQuotes';

const STORAGE_KEY = '@motivational_quote_index';

/**
 * Mostra uma frase motivacional no lugar onde estava o título da app.
 *
 * A frase muda a cada nova abertura da app (não a cada re-render): ao montar,
 * lê de AsyncStorage o índice da última frase mostrada, mostra a frase
 * seguinte da lista e grava esse novo índice — avançando sempre sequencialmente
 * e dando a volta ao array (% length), para garantir que todas as frases vão
 * sendo mostradas ao fim de MOTIVATIONAL_QUOTES.length aberturas, antes de
 * qualquer repetição.
 *
 * Estilo: letras grandes, maiúsculas e a negrito (peso 900), tal como no
 * mockup de referência ("FIND YOUR STRENGTH"). Como o espaço no ecrã é
 * limitado, o texto nunca ocupa mais do que 2 linhas — usa
 * adjustsFontSizeToFit para reduzir automaticamente o tamanho da letra só o
 * necessário para caber, por isso frases curtas (que cabem numa linha) ficam
 * sempre com a fonte maior, e só as mais compridas são que encolhem.
 */
export default function MotivationalQuote({ style }) {
  const [quote, setQuote] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadNextQuote = async () => {
      let currentIndex = 0;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          const parsed = parseInt(stored, 10);
          if (!Number.isNaN(parsed)) currentIndex = parsed;
        }
      } catch (e) {
        // Se a leitura falhar, começa do início da lista sem rebentar o ecrã.
        currentIndex = 0;
      }

      const total = MOTIVATIONAL_QUOTES.length;
      const safeIndex = ((currentIndex % total) + total) % total;

      if (isMounted) setQuote(MOTIVATIONAL_QUOTES[safeIndex]);

      try {
        await AsyncStorage.setItem(STORAGE_KEY, String((safeIndex + 1) % total));
      } catch (e) {
        // Falha a gravar o próximo índice não deve impedir mostrar a frase atual.
      }
    };

    loadNextQuote();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!quote) return <Text style={style} />;

  return (
    <Text
      style={style}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.45}
    >
      {quote}
    </Text>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronDown, ChevronUp } from "lucide-react";

// Interface para as tracks do Deezer
interface Track {
  id: number;
  title: string;
  preview: string;
  artist: {
    name: string;
  };
  album: {
    title: string;
    cover_medium: string;
    cover_xl: string;
  };
}

// Interface para as playlists do Deezer
interface Playlist {
  id: number;
  title: string;
  tracks: {
    data: Track[];
  };
}

export default function DeezerCarousel() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down' | null>(null);
  const [transitionComplete, setTransitionComplete] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Função para lidar com início de toque (touch)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touchStartY = e.touches[0].clientY;
    // Armazenar o valor em um estado ou ref para usar em handleTouchEnd
    (e.currentTarget as any).touchStartY = touchStartY;
  };
  
  // Função para lidar com fim de toque (touch)
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isScrolling || !transitionComplete) return;
    
    const touchStartY = (e.currentTarget as any).touchStartY || 0;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    
    // Detectar direção do swipe
    if (Math.abs(diff) > 50) { // Limite mínimo para considerar um swipe
      setIsScrolling(true);
      setTransitionComplete(false);
      
      if (diff > 0) {
        // Swipe para cima - próximo slide
        if (currentTrackIndex < tracks.length - 1) {
          const nextIndex = currentTrackIndex + 1;
          setPreviewIndex(nextIndex);
          setAnimationDirection('down');
          scrollToSlide(nextIndex);
        }
      } else {
        // Swipe para baixo - slide anterior
        if (currentTrackIndex > 0) {
          const prevIndex = currentTrackIndex - 1;
          setPreviewIndex(prevIndex);
          setAnimationDirection('up');
          scrollToSlide(prevIndex);
        }
      }
      
      // Prevenir múltiplos eventos de scroll
      setTimeout(() => {
        setIsScrolling(false);
      }, 500);
      
      // Permitir nova transição depois de completar a atual
      setTimeout(() => {
        setTransitionComplete(true);
      }, 1000);
    }
  };

  // Função para lidar com o evento de roda do mouse
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (isScrolling || !transitionComplete) return;
    
    setIsScrolling(true);
    setTransitionComplete(false);
    
    // Determinar a direção do scroll
    if (e.deltaY > 0) {
      // Scroll para baixo - próximo slide
      if (currentTrackIndex < tracks.length - 1) {
        const nextIndex = currentTrackIndex + 1;
        setPreviewIndex(nextIndex);
        setAnimationDirection('down');
        scrollToSlide(nextIndex);
      }
    } else {
      // Scroll para cima - slide anterior
      if (currentTrackIndex > 0) {
        const prevIndex = currentTrackIndex - 1;
        setPreviewIndex(prevIndex);
        setAnimationDirection('up');
        scrollToSlide(prevIndex);
      }
    }
    
    // Prevenir múltiplos eventos de scroll
    setTimeout(() => {
      setIsScrolling(false);
    }, 500);
    
    // Permitir nova transição depois de completar a atual
    setTimeout(() => {
      setTransitionComplete(true);
    }, 1000);
  };

  // Fetch da API do Deezer usando um proxy CORS
  useEffect(() => {
    const fetchMusicFromDeezer = async () => {
      try {
        setLoading(true);
        
        // Uso de um proxy CORS público
        const corsProxy = "https://corsproxy.io/?";
        
        // Buscar uma playlist específica
        const playlistId = 13829671201; // Playlist popular no Deezer
        const apiUrl = `${corsProxy}https://api.deezer.com/playlist/${playlistId}`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error("Falha ao buscar dados da API Deezer");
        }
        
        const data: Playlist = await response.json();
        
        // Extraindo as músicas da playlist
        if (data && data.tracks && data.tracks.data) {
          setTracks(data.tracks.data);
          // Inicializar o array de refs com o tamanho correto
          slideRefs.current = data.tracks.data.map(() => null);
        } else {
          // Caso não tenha encontrado músicas na playlist, busca tracks populares
          const chartsUrl = `${corsProxy}https://api.deezer.com/chart/0/tracks`;
          const chartsResponse = await fetch(chartsUrl);
          
          if (!chartsResponse.ok) {
            throw new Error("Falha ao buscar dados alternativos da API Deezer");
          }
          
          const chartsData = await chartsResponse.json();
          setTracks(chartsData.data || []);
          // Inicializar o array de refs com o tamanho correto
          slideRefs.current = chartsData.data.map(() => null);
        }
      } catch (err) {
        console.error("Erro ao buscar músicas:", err);
        setError("Não foi possível carregar as músicas. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchMusicFromDeezer();
  }, []);

  // Controles de reprodução de áudio
  useEffect(() => {
    if (!audioRef.current || tracks.length === 0) return;

    const audioElement = audioRef.current;

    const handleTimeUpdate = () => {
      const duration = audioElement.duration;
      if (duration) {
        setProgress((audioElement.currentTime / duration) * 100);
      }
    };

    const handleEnded = () => {
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
        scrollToSlide(currentTrackIndex + 1);
      } else {
        setCurrentTrackIndex(0);
        scrollToSlide(0);
        setIsPlaying(false);
      }
    };

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("ended", handleEnded);

    // Começar a tocar o áudio se isPlaying for true
    if (isPlaying) {
      audioElement.play().catch(err => {
        console.error("Erro ao reproduzir áudio:", err);
        setIsPlaying(false);
      });
    } else {
      audioElement.pause();
    }

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [isPlaying, currentTrackIndex, tracks]);

  // Configuração do scroll snap e animações
  useEffect(() => {
    const handleScroll = () => {
      if (!carouselRef.current) return;
      
      // Calcular a posição do scroll relativa à altura da página
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      
      // Atualizar a posição do scroll para usar nas animações
      setScrollPosition(scrollY / windowHeight);
      
      // Determinar qual é o próximo slide baseado na direção do scroll
      const targetIndex = Math.round(scrollPosition);
      if (targetIndex !== currentTrackIndex && targetIndex >= 0 && targetIndex < tracks.length) {
        setPreviewIndex(targetIndex);
        
        // Determinar a direção do movimento para animação
        if (targetIndex > currentTrackIndex) {
          setAnimationDirection('down');
        } else if (targetIndex < currentTrackIndex) {
          setAnimationDirection('up');
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrollPosition, currentTrackIndex, tracks.length]);

  // Detectar quando uma transição termina para mudar de faixa
  useEffect(() => {
    // Se temos um preview index e o scroll não está em andamento
    if (previewIndex !== null && !isScrolling && transitionComplete) {
      setCurrentTrackIndex(previewIndex);
      setPreviewIndex(null);
      setAnimationDirection(null);
      
      // Se estiver tocando, atualize o áudio
      if (isPlaying && audioRef.current) {
        audioRef.current.src = tracks[previewIndex].preview;
        audioRef.current.play().catch(err => {
          console.error("Erro ao reproduzir áudio:", err);
        });
      }
    }
  }, [previewIndex, isScrolling, transitionComplete, isPlaying, tracks]);

  // Configurar os event listeners de wheel e touch
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    
    // Adicionar event listeners com opções adequadas
    carousel.addEventListener('wheel', (e) => {
      e.preventDefault();
      handleWheel(e as unknown as React.WheelEvent<HTMLDivElement>);
    }, { passive: false });
    
    return () => {
      if (carousel) {
        carousel.removeEventListener('wheel', (e) => {
          e.preventDefault();
          handleWheel(e as unknown as React.WheelEvent<HTMLDivElement>);
        });
      }
    };
  }, [currentTrackIndex, tracks.length, isScrolling, transitionComplete]);

  // Rolar para o slide específico
  const scrollToSlide = (index: number) => {
    const slide = slideRefs.current[index];
    if (slide) {
      slide.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Preview da próxima música
  const getPreviewStyle = (index: number) => {
    if (previewIndex === null || animationDirection === null) return {};
    
    const isPreview = index === previewIndex;
    const isCurrent = index === currentTrackIndex;
    
    if (isPreview) {
      // Estilo para a prévia que está entrando
      return {
        transform: animationDirection === 'down' 
          ? `translateY(${100 - (scrollPosition - Math.floor(scrollPosition)) * 100}%)` 
          : `translateY(-${100 - ((1 - scrollPosition) + Math.floor(scrollPosition)) * 100}%)`,
        opacity: 0.9,
        zIndex: 10
      };
    } else if (isCurrent) {
      // Estilo para o slide atual que está saindo
      return {
        transform: animationDirection === 'down' 
          ? `translateY(-${(scrollPosition - Math.floor(scrollPosition)) * 100}%)` 
          : `translateY(${((1 - scrollPosition) + Math.floor(scrollPosition)) * 100}%)`,
        opacity: 1,
        zIndex: 20
      };
    }
    
    return {};
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevTrack = () => {
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      scrollToSlide(prevIndex);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIndex < tracks.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextIndex);
      scrollToSlide(nextIndex);
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current) return;
    
    const progressBar = progressBarRef.current;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const percentage = (clickPosition / progressBarWidth) * 100;
    
    setProgress(percentage);
    audioRef.current.currentTime = (percentage / 100) * audioRef.current.duration;
  };

  // Renderização condicional enquanto carrega
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Renderização em caso de erro
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  // Se não tiver músicas
  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 text-xl">Nenhuma música encontrada</div>
      </div>
    );
  }

  return (
    <div 
      ref={carouselRef}
      className="w-full h-screen overflow-hidden bg-gray-900"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Carrossel */}
      <div className="w-full h-full relative">
        {tracks.map((track, index) => (
          <div 
            key={track.id}
            ref={el => slideRefs.current[index] = el}
            className={`w-full h-screen absolute top-0 left-0 flex flex-col justify-center items-center p-4 transition-all duration-1000 ${
              index === currentTrackIndex || index === previewIndex
                ? 'opacity-100 visible' 
                : 'opacity-0 invisible'
            }`}
            style={{
              backgroundColor: '#121212',
              ...getPreviewStyle(index)
            }}
          >
            <div className="max-w-6xl w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-4">
              <p className="text-xl font-medium text-gradient" style={{ color: "var(--primary-color)" }}>Nos temos até uma playlist só nossa, acredita?</p>
              {/* Capa do álbum com transição */}
              <div className="w-full md:w-1/2 flex justify-center items-center transition-transform duration-700">
                <img 
                  src={track.album.cover_xl || "/api/placeholder/400/400"}
                  alt={track.title}
                  className="rounded-lg shadow-2xl max-w-full max-h-96 object-contain transition-all duration-700 hover:scale-105"
                  style={{
                    transform: index === previewIndex ? 'scale(0.9)' : 'scale(1)',
                    opacity: index === previewIndex ? 0.8 : 1
                  }}
                />
              </div>
              
              {/* Informações e controles */}
              <div className="w-full md:w-1/2 flex flex-col items-center md:items-start space-y-6 transition-all duration-700"
                style={{
                  transform: index === previewIndex ? 'translateY(20px)' : 'translateY(0)',
                  opacity: index === previewIndex ? 0.8 : 1
                }}
              >
                <div className="text-center md:text-left">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{track.title}</h2>
                  <p className="text-xl text-gray-300 mb-1">{track.artist.name}</p>
                  <p className="text-lg text-gray-400">{track.album.title}</p>
                </div>
                
                {/* Barra de progresso - mostrada apenas para a faixa atual */}
                {currentTrackIndex === index && (
                  <div className="w-full mt-8 transition-transform duration-500">
                    <div 
                      ref={progressBarRef}
                      className="w-full h-3 bg-gray-700 rounded-full cursor-pointer"
                      onClick={handleProgressClick}
                    >
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Botões de controle - mostrados apenas para a faixa atual */}
                {currentTrackIndex === index && (
                  <div className="flex items-center justify-center space-x-8 mt-6 transition-all duration-500">
                    <button 
                      onClick={handlePrevTrack}
                      className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transform transition-transform hover:scale-110"
                      disabled={currentTrackIndex === 0}
                    >
                      <SkipBack size={24} />
                    </button>
                    
                    <button 
                      onClick={handlePlayPause}
                      className="p-5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transform transition-transform hover:scale-110"
                    >
                      {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                    </button>
                    
                    <button 
                      onClick={handleNextTrack}
                      className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transform transition-transform hover:scale-110"
                      disabled={currentTrackIndex === tracks.length - 1}
                    >
                      <SkipForward size={24} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Indicador de navegação */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="flex space-x-2">
                {tracks.map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      i === currentTrackIndex 
                        ? "bg-blue-500 w-6" 
                        : i === previewIndex 
                          ? "bg-blue-400 w-4" 
                          : "bg-gray-600"
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Indicadores de scroll */}
      {currentTrackIndex < tracks.length - 1 && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center animate-bounce">
          <ChevronDown size={32} className="text-white opacity-60" />
        </div>
      )}
      
      {currentTrackIndex > 0 && (
        <div className="absolute top-20 left-0 right-0 flex justify-center animate-bounce">
          <ChevronUp size={32} className="text-white opacity-60" />
        </div>
      )}

      {/* Elemento de áudio oculto */}
      <audio
        ref={audioRef}
        src={tracks[currentTrackIndex]?.preview}
        preload="auto"
        className="hidden"
      />
    </div>
  );
}
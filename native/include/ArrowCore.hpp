#pragma once
#include <vector>
#include <cstdint>
#include <cmath>
#include <stdexcept>
#include <algorithm>
#include <cstddef>

namespace gogo::arrowout {
struct Cell { int x=0,y=0; };
struct Piece { std::vector<Cell> cells; int dir=0; int step=0; bool alive=true; };
struct Board { int width=0,height=0; std::vector<Piece> pieces; };

inline bool valid(const Board& b) {
 if(b.width<1||b.height<1||b.width>72||b.height>72) return false;
 for(const auto& p:b.pieces) {
  if(p.dir<0||p.dir>3||p.cells.empty()) return false;
  for(std::size_t i=0;i<p.cells.size();++i) {
   const auto c=p.cells[i];
   if(c.x<0||c.y<0||c.x>=b.width||c.y>=b.height) return false;
   if(i&&std::abs(c.x-p.cells[i-1].x)+std::abs(c.y-p.cells[i-1].y)!=1) return false;
   for(std::size_t j=0;j<i;++j)
    if(p.cells[j].x==c.x&&p.cells[j].y==c.y) return false;
  }
 }
 return true;
}

inline std::vector<int> occupancy(const Board& b) {
 if(!valid(b)) throw std::invalid_argument("invalid board");
 std::vector<int> occ(static_cast<std::size_t>(b.width)*static_cast<std::size_t>(b.height),-1);
 for(std::size_t i=0;i<b.pieces.size();++i) if(b.pieces[i].alive) {
  for(const auto c:b.pieces[i].cells) {
   auto& slot=occ[static_cast<std::size_t>(c.y*b.width+c.x)];
   if(slot!=-1) throw std::invalid_argument("overlapping pieces");
   slot=static_cast<int>(i);
  }
 }
 return occ;
}

inline bool validOccupancy(const Board& b,const std::vector<int>& occ) {
 if(!valid(b)||occ.size()!=static_cast<std::size_t>(b.width)*static_cast<std::size_t>(b.height)) return false;
 for(const int owner:occ)
  if(owner < -1 || owner >= static_cast<int>(b.pieces.size()) ||
     (owner>=0&&!b.pieces[static_cast<std::size_t>(owner)].alive)) return false;
 try { return occ==occupancy(b); } catch(const std::invalid_argument&) { return false; }
}

// Returns blocker index, -1 if clear, -2 if invalid. Only the head exit ray blocks.
inline int pieceBlocker(const Board& b,const std::vector<int>& occ,int pi) {
 if(pi<0||pi>=static_cast<int>(b.pieces.size())||!validOccupancy(b,occ)||
    !b.pieces[static_cast<std::size_t>(pi)].alive) return -2;
 const int dx[4]={0,1,0,-1},dy[4]={-1,0,1,0};
 const auto& p=b.pieces[static_cast<std::size_t>(pi)];
 const auto head=p.cells.back();
 for(int x=head.x+dx[p.dir],y=head.y+dy[p.dir];
     x>=0&&x<b.width&&y>=0&&y<b.height;
     x+=dx[p.dir],y+=dy[p.dir]) {
  const int other=occ[static_cast<std::size_t>(y*b.width+x)];
  if(other!=-1&&other!=pi) return other;
 }
 return -1;
}

inline bool removePiece(Board& b,int pi) {
 if(!valid(b)||pi<0||pi>=static_cast<int>(b.pieces.size())) return false;
 std::vector<int> occ;
 try { occ=occupancy(b); } catch(const std::invalid_argument&) { return false; }
 if(pieceBlocker(b,occ,pi)!=-1) return false;
 b.pieces[static_cast<std::size_t>(pi)].alive=false;
 return true;
}
} // namespace gogo::arrowout
